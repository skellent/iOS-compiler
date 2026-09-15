from datetime import datetime
from pathlib import Path

from fastapi            import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses  import HTMLResponse

from modules.cursor       import Queries, DuplicateRecordError
from modules.credentials  import get_credentials
from modules.db           import cursor
from modules.email_check  import UndeliverableEmailError, assert_deliverable
from modules.guard        import Guard
from modules.limiter      import limiter
from modules.logs         import get_logger
from modules.mail         import Mail
from modules.pages        import Pages
from modules.token        import Token
from modules.types        import User, UserLogin, PasswordResetRequest, PasswordResetConfirm, AccountDeletionRequest

router = APIRouter(prefix="/auth", tags=["auth"])

_URL_BASE: str = get_credentials()['api_base_url']
_CONTACT_EMAIL: str | None = get_credentials()['email']['from']
_logger = get_logger(__name__)


@router.post("/register", status_code=201)
@limiter.limit("5/hour")
def register(request: Request, data: User, background_tasks: BackgroundTasks):
    # Reject an address whose domain can't receive mail before creating the account,
    # so a typo'd email doesn't leave a user stuck with an account they can never
    # confirm and can never re-register (the email UNIQUE constraint would block them).
    try:
        assert_deliverable(data.email)
    except UndeliverableEmailError as e:
        raise HTTPException(status_code=422, detail=str(e))

    password_hash: str = Guard.Hash(data.password)
    try:
        cursor.execute(Queries.INSERT_USER, (
            data.name,
            data.phone,
            data.email,
            password_hash)
        )
    except DuplicateRecordError:
        raise HTTPException(status_code=409, detail="Phone or email already registered")
    cursor.commit()
    user_id: int = cursor.lastrowid
    _logger.info(f"User {user_id} registered")

    token: str = Token.CreateUserConfirmation(user_id)
    background_tasks.add_task(
        Mail.Send,
        data.email,
        "Confirm your Panic Button account",
        "user_confirmation",
        {
            "user_name":        data.name,
            "confirmation_url": f"{_URL_BASE}/auth/confirm/{token}",
        },
    )

    return {"id": user_id, "email": data.email, "confirmation_email_sent": True}


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, data: UserLogin):
    rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_EMAIL, (data.email,))
    if not rows or not Guard.Verify(data.password, rows[0]["password_hash"]):
        _logger.warning(f"Failed login attempt for {data.email}")
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not rows[0]["confirmed"]:
        _logger.warning(f"Login attempt for unconfirmed account {rows[0]['id']}")
        raise HTTPException(status_code=403, detail="Please confirm your email before logging in")

    _logger.info(f"User {rows[0]['id']} logged in")
    token: str = Token.Create(rows[0]["id"])
    return {"access_token": token, "token_type": "bearer"}


@router.get("/confirm/{token}", response_class=HTMLResponse)
def confirm_user(token: str):
    user_id: int | None = Token.ValidateUserConfirmation(token)
    if user_id is None:
        _logger.warning("User confirmation attempted with an invalid or expired token")
        return HTMLResponse(
            Pages.Render("confirmation_result", {
                "success": False,
                "message": "This confirmation link is invalid or has expired.",
            }),
            status_code=401,
        )

    cursor.execute(Queries.CONFIRM_USER, (user_id,))
    if cursor.rowcount == 0:
        _logger.warning(f"Confirmation attempted for user {user_id}, which no longer exists")
        return HTMLResponse(
            Pages.Render("confirmation_result", {
                "success": False,
                "message": "This account no longer exists, so there's nothing left to confirm.",
            }),
            status_code=404,
        )
    cursor.commit()
    _logger.info(f"User {user_id} confirmed their email")

    return HTMLResponse(
        Pages.Render("confirmation_result", {
            "success": True,
            "message": "Your account is confirmed. Open the Panic Button app and log in to get started.",
        })
    )


@router.post("/password-reset/request")
@limiter.limit("5/hour")
def request_password_reset(request: Request, data: PasswordResetRequest, background_tasks: BackgroundTasks):
    rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_EMAIL, (data.email,))
    if rows:
        user: dict = rows[0]
        token: str = Token.CreatePasswordReset(user["id"])
        background_tasks.add_task(
            Mail.Send,
            user["email"],
            "Reset your Panic Button password",
            "password_reset",
            {
                "user_name": user["name"],
                "reset_url": f"{_URL_BASE}/auth/password-reset/{token}",
            },
        )
        _logger.info(f"Password reset requested for user {user['id']}")
    else:
        _logger.info(f"Password reset requested for unknown email {data.email}")

    return {"password_reset_email_sent": True}


@router.get("/password-reset/{token}", response_class=HTMLResponse)
def password_reset_page(token: str):
    if Token.ValidatePasswordReset(token) is None:
        return HTMLResponse(
            Pages.Render("confirmation_result", {
                "success": False,
                "message": "This password reset link is invalid or has expired. Request a new one from the app.",
            }),
            status_code=401,
        )
    return HTMLResponse(Pages.Render("password_reset", {"reset_token": token}))


@router.post("/password-reset/{token}")
def perform_password_reset(token: str, data: PasswordResetConfirm, background_tasks: BackgroundTasks):
    user_id: int | None = Token.ValidatePasswordReset(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="This password reset link is invalid or has expired.")

    rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="This account no longer exists.")

    cursor.execute(Queries.UPDATE_USER_PASSWORD, (Guard.Hash(data.password), user_id))
    cursor.commit()
    _logger.info(f"User {user_id} reset their password")

    user: dict = rows[0]
    background_tasks.add_task(
        Mail.Send,
        user["email"],
        "Your Panic Button password was changed",
        "security_alert",
        {
            "user_name":     user["name"],
            "change_label":  "password",
            "timestamp":     datetime.now().strftime("%m/%d/%Y %H:%M:%S"),
            "contact_email": _CONTACT_EMAIL,
        },
    )

    return {"password_reset": True}


@router.post("/account-deletion/request")
@limiter.limit("5/hour")
def request_account_deletion(request: Request, data: AccountDeletionRequest, background_tasks: BackgroundTasks):
    rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_EMAIL, (data.email,))
    if rows:
        user: dict = rows[0]
        token: str = Token.CreateAccountDeletion(user["id"])
        background_tasks.add_task(
            Mail.Send,
            user["email"],
            "Confirm deletion of your Panic Button account",
            "account_deletion",
            {
                "user_name":    user["name"],
                "deletion_url": f"{_URL_BASE}/auth/account-deletion/{token}",
            },
        )
        _logger.info(f"Account deletion requested for user {user['id']}")
    else:
        _logger.info(f"Account deletion requested for unknown email {data.email}")

    return {"account_deletion_email_sent": True}


@router.get("/account-deletion/{token}", response_class=HTMLResponse)
def account_deletion_page(token: str):
    if Token.ValidateAccountDeletion(token) is None:
        return HTMLResponse(
            Pages.Render("confirmation_result", {
                "success": False,
                "message": "This account deletion link is invalid or has expired. Request a new one from the deletion page.",
            }),
            status_code=401,
        )
    return HTMLResponse(Pages.Render("account_deletion_confirm", {"deletion_token": token}))


@router.post("/account-deletion/{token}")
def perform_account_deletion(token: str):
    user_id: int | None = Token.ValidateAccountDeletion(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="This account deletion link is invalid or has expired.")

    rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="This account no longer exists.")

    video_paths = [Path(row["local_path"]) for row in cursor.execute(Queries.SELECT_ALERT_VIDEO_PATHS_BY_USER, (user_id,))]
    video_dir = Path(__file__).resolve().parents[2] / "data" / "videos"

    with cursor.transaction():
        cursor.execute(Queries.DELETE_ALERT_NOTIFICATIONS_BY_USER, (user_id,))
        cursor.execute(Queries.DELETE_ALERT_VIDEOS_BY_USER, (user_id,))
        cursor.execute(Queries.DELETE_ALERTS_BY_USER, (user_id,))
        cursor.execute(Queries.DELETE_SOCIAL_CONNECTIONS_BY_USER, (user_id,))
        cursor.execute(Queries.DELETE_CONTACTS_BY_USER, (user_id,))
        cursor.execute(Queries.DELETE_USER_BY_ID, (user_id,))
    for path in video_paths:
        if path.parent == video_dir:
            try:
                path.unlink(missing_ok=True)
            except OSError as exc:
                _logger.error(f"Could not remove deleted user's local video file: {exc}")
    _logger.info(f"User {user_id} deleted their account and associated data")

    return {"account_deleted": True}
