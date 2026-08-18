from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from modules.cursor       import Queries, DuplicateRecordError
from modules.credentials  import get_credentials
from modules.db           import cursor
from modules.dependencies import current_user
from modules.email_check  import UndeliverableEmailError, assert_deliverable
from modules.guard        import Guard
from modules.logs         import get_logger
from modules.mail         import Mail
from modules.types        import UserPublic, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])
_logger = get_logger(__name__)
_CONTACT_EMAIL: str = get_credentials()['email']['from']


def _notify_security_change(background_tasks, recipient: str, user_name: str, change_label: str) -> None:
    """Tell the account owner (at the address on file *before* the change) that a
    sensitive change happened — so an attacker who swaps the email can't do it
    silently."""
    if not recipient:
        return
    background_tasks.add_task(
        Mail.Send,
        recipient,
        "Your Panic Button account was changed",
        "security_alert",
        {
            "user_name":     user_name,
            "change_label":  change_label,
            "timestamp":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "contact_email": _CONTACT_EMAIL,
        },
    )

_COLUMN_BY_FIELD: dict[str, str] = {
    "name":     "name",
    "phone":    "phone",
    "email":    "email",
    "password": "password_hash",
}

# Changing either of these is a security-sensitive action, so it requires the
# account's current password even though the session token is already valid.
_SENSITIVE_FIELDS: frozenset[str] = frozenset({"email", "password"})


@router.get("/me", response_model=UserPublic)
def get_current_user(user_id: int = Depends(current_user)):
    rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")
    return rows[0]


@router.put("/me", response_model=UserPublic)
def update_current_user(data: UserUpdate, background_tasks: BackgroundTasks,
                        user_id: int = Depends(current_user)):
    fields: dict = data.model_dump(exclude_none=True)
    current_password: str | None = fields.pop("current_password", None)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields were provided to update")

    changing_sensitive: bool = bool(_SENSITIVE_FIELDS & fields.keys())
    if changing_sensitive:
        # Re-authenticate: a stolen 30-day session token alone must not be enough to
        # take over the account by swapping its email or password.
        if not current_password:
            raise HTTPException(
                status_code=400,
                detail="Your current password is required to change your email or password",
            )
        hash_rows: list[dict] = cursor.execute(Queries.SELECT_USER_HASH_BY_ID, (user_id,))
        if not hash_rows:
            raise HTTPException(status_code=404, detail="User not found")
        if not Guard.Verify(current_password, hash_rows[0]["password_hash"]):
            _logger.warning(f"User {user_id} gave a wrong current password for a sensitive change")
            raise HTTPException(status_code=403, detail="Current password is incorrect")

    if "email" in fields:
        try:
            assert_deliverable(fields["email"])
        except UndeliverableEmailError as e:
            raise HTTPException(status_code=422, detail=str(e))

    # Capture the pre-change email/name so the security notice reaches the address
    # that owned the account *before* an email swap, not the attacker's new one.
    before: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    if not before:
        raise HTTPException(status_code=404, detail="User not found")
    old_email: str = before[0]["email"]
    user_name: str = before[0]["name"]

    if "password" in fields:
        fields["password"] = Guard.Hash(fields["password"])

    set_clause: str = ", ".join(f"{_COLUMN_BY_FIELD[field]} = %s" for field in fields)
    values: tuple = tuple(str(value) for value in fields.values()) + (user_id,)

    try:
        cursor.execute(f"UPDATE users SET {set_clause} WHERE id = %s;", values)
    except DuplicateRecordError:
        raise HTTPException(status_code=409, detail="Phone or email already registered")
    cursor.commit()
    _logger.info(f"User {user_id} updated fields: {', '.join(fields.keys())}")

    if "password" in fields:
        _notify_security_change(background_tasks, old_email, user_name, "password")
    if "email" in fields:
        _notify_security_change(background_tasks, old_email, user_name, "email address")

    rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")
    return rows[0]
