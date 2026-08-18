import secrets

from fastapi           import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import HTMLResponse

from modules.mail         import Mail
from modules.credentials  import get_credentials
from modules.cursor       import Queries, DuplicateRecordError
from modules.db           import cursor
from modules.dependencies import current_user
from modules.logs         import get_logger
from modules.pages        import Pages
from modules.telegram     import LINK_EXPIRATION
from modules.token        import Token
from modules.types        import Contact, ContactPublic, ContactUpdate, TelegramLink

router = APIRouter(prefix="/contacts", tags=["contacts"])

MAX_CONTACTS: int = 4

_URL_BASE: str = get_credentials()['api_base_url']
_TELEGRAM_BOT_USERNAME: str | None = get_credentials()['telegram']['bot_username']
_LINK_EXPIRATION_HOURS: int = int(LINK_EXPIRATION.total_seconds() // 3600)
_logger = get_logger(__name__)

_COLUMN_BY_FIELD: dict[str, str] = {
    "name":  "name",
    "phone": "phone",
    "email": "email",
}


@router.post("", status_code=201, response_model=ContactPublic)
def create_contact(data: Contact, background_tasks: BackgroundTasks, user_id: int = Depends(current_user)):
    # Count and insert happen inside one transaction, behind a row lock on this
    # user, so two concurrent requests can't both read "3 contacts" and both write.
    with cursor.transaction():
        if not cursor.execute(Queries.LOCK_USER, (user_id,)):
            raise HTTPException(status_code=404, detail="User not found")

        total: int = cursor.execute(Queries.COUNT_CONTACTS_BY_USER, (user_id,))[0]["total"]
        if total >= MAX_CONTACTS:
            raise HTTPException(
                status_code=400,
                detail=f"You can have at most {MAX_CONTACTS} emergency contacts",
            )

        try:
            cursor.execute(Queries.INSERT_CONTACT, (user_id, data.name, data.phone, data.email))
        except DuplicateRecordError:
            raise HTTPException(status_code=409, detail="That contact already exists")
        contact_id: int = cursor.lastrowid

    _logger.info(f"User {user_id} added contact {contact_id}")

    if data.email:
        rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
        if rows:
            token: str = Token.CreateContactConfirmation(contact_id)
            background_tasks.add_task(
                Mail.Send,
                data.email,
                "Confirm that you are an emergency contact",
                "contact_confirmation",
                {
                    "contact_name":     data.name,
                    "user_name":        rows[0]["name"],
                    "confirmation_url": f"{_URL_BASE}/contacts/confirm/{token}",
                },
            )

    created: list[dict] = cursor.execute(Queries.SELECT_CONTACT_BY_ID, (contact_id, user_id))
    return created[0]


@router.get("", response_model=list[ContactPublic])
def list_contacts(user_id: int = Depends(current_user)):
    return cursor.execute(Queries.SELECT_CONTACTS_BY_USER, (user_id,))


@router.get("/confirm/{token}", response_class=HTMLResponse)
def confirm_contact(token: str):
    contact_id: int | None = Token.ValidateContactConfirmation(token)
    if contact_id is None:
        _logger.warning("Contact confirmation attempted with an invalid or expired token")
        return HTMLResponse(
            Pages.Render("confirmation_result", {
                "success": False,
                "message": "This confirmation link is invalid or has expired. Ask to be added as an emergency contact again to get a new one.",
            }),
            status_code=401,
        )

    cursor.execute(Queries.CONFIRM_CONTACT, (contact_id,))
    if cursor.rowcount == 0:
        _logger.warning(f"Confirmation attempted for contact {contact_id}, which no longer exists")
        return HTMLResponse(
            Pages.Render("confirmation_result", {
                "success": False,
                "message": "This contact no longer exists, so there's nothing left to confirm.",
            }),
            status_code=404,
        )
    cursor.commit()
    _logger.info(f"Contact {contact_id} confirmed by email")

    return HTMLResponse(
        Pages.Render("confirmation_result", {
            "success": True,
            "message": "You'll now be notified by email if this person triggers a panic alert.",
        })
    )


@router.put("/{contact_id}", response_model=ContactPublic)
def update_contact(contact_id: int, data: ContactUpdate, user_id: int = Depends(current_user)):
    fields: dict = data.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields were provided to update")

    # Column names come from a fixed map rather than straight from the payload keys,
    # matching users.py — Pydantic already constrains them, this makes it structural.
    set_clause: str = ", ".join(f"{_COLUMN_BY_FIELD[field]} = %s" for field in fields)
    values: tuple = tuple(str(value) for value in fields.values()) + (contact_id, user_id)

    try:
        cursor.execute(f"UPDATE contacts SET {set_clause} WHERE id = %s AND user_id = %s;", values)
    except DuplicateRecordError:
        raise HTTPException(status_code=409, detail="That contact already exists")

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    cursor.commit()

    rows: list[dict] = cursor.execute(Queries.SELECT_CONTACT_BY_ID, (contact_id, user_id))
    if not rows:
        raise HTTPException(status_code=404, detail="Contact not found")
    return rows[0]


@router.delete("/{contact_id}", status_code=204)
def delete_contact(contact_id: int, user_id: int = Depends(current_user)):
    cursor.execute(Queries.DELETE_CONTACT, (contact_id, user_id))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    cursor.commit()
    _logger.info(f"User {user_id} deleted contact {contact_id}")


@router.post("/{contact_id}/telegram/enable", response_model=TelegramLink)
def enable_contact_telegram(contact_id: int, background_tasks: BackgroundTasks, user_id: int = Depends(current_user)):
    # Without a username there is no valid t.me link to build; emailing
    # "https://t.me/None?start=..." to a contact is worse than refusing.
    if not _TELEGRAM_BOT_USERNAME:
        raise HTTPException(status_code=503, detail="Telegram is not configured on this deployment")

    link_token: str = secrets.token_urlsafe(24)

    # Expiry is computed by MariaDB (NOW() + INTERVAL) because the check that reads
    # it back is also SQL. Deriving it from the Python process's local clock meant
    # two different timezones deciding the same deadline.
    cursor.execute(
        Queries.SET_CONTACT_TELEGRAM_LINK_TOKEN,
        (link_token, _LINK_EXPIRATION_HOURS, contact_id, user_id),
    )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    cursor.commit()
    _logger.info(f"User {user_id} started a Telegram link for contact {contact_id}")

    rows: list[dict] = cursor.execute(Queries.SELECT_CONTACT_BY_ID, (contact_id, user_id))
    if not rows:
        raise HTTPException(status_code=404, detail="Contact not found")
    contact: dict = rows[0]
    telegram_link_url: str = f"https://t.me/{_TELEGRAM_BOT_USERNAME}?start={link_token}"

    if contact["email"]:
        user_rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
        if user_rows:
            background_tasks.add_task(
                Mail.Send,
                contact["email"],
                "Link Telegram to receive panic alerts",
                "telegram_link",
                {
                    "contact_name":      contact["name"],
                    "user_name":         user_rows[0]["name"],
                    "telegram_link_url": telegram_link_url,
                },
            )
            return {"telegram_link_url": None}

    return {"telegram_link_url": telegram_link_url}


@router.delete("/{contact_id}/telegram", status_code=204)
def disable_contact_telegram(contact_id: int, user_id: int = Depends(current_user)):
    cursor.execute(Queries.CLEAR_CONTACT_TELEGRAM, (contact_id, user_id))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    cursor.commit()
    _logger.info(f"User {user_id} disconnected Telegram for contact {contact_id}")
