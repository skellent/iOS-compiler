from fastapi            import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses  import HTMLResponse

from modules.cursor       import Queries, DuplicateRecordError
from modules.credentials  import get_credentials
from modules.db           import cursor
from modules.guard        import Guard
from modules.logs         import get_logger
from modules.mail         import Mail
from modules.pages        import Pages
from modules.token        import Token
from modules.types        import User, UserLogin

router = APIRouter(prefix="/auth", tags=["auth"])

_URL_BASE: str = get_credentials()['api_base_url']
_logger = get_logger(__name__)


@router.post("/register", status_code=201)
def register(data: User, background_tasks: BackgroundTasks):
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
        "Confirm your Panic Switch account",
        "user_confirmation",
        {
            "user_name":        data.name,
            "confirmation_url": f"{_URL_BASE}/auth/confirm/{token}",
        },
    )

    return {"Skellent": "Success!"}


@router.post("/login")
def login(data: UserLogin):
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
            "message": "Your account is confirmed. Open the Panic Switch app and log in to get started.",
        })
    )
