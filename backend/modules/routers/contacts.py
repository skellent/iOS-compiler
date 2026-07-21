from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from modules.mail         import Mail
from modules.credentials  import get_credentials
from modules.cursor       import Queries
from modules.db           import cursor
from modules.dependencies import current_user
from modules.token        import Token
from modules.types        import Contact, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])

_URL_BASE: str = get_credentials()['api_base_url']


@router.post("", status_code=201)
def create_contact(data: Contact, background_tasks: BackgroundTasks, user_id: int = Depends(current_user)):
    cursor.execute(Queries.INSERT_CONTACT, (user_id, data.name, data.phone, data.email))
    cursor.commit()
    contact_id: int = cursor.lastrowid

    if data.email:
        rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
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

    return {"Skellent": "Success!"}


@router.get("")
def list_contacts(user_id: int = Depends(current_user)):
    return cursor.execute(Queries.SELECT_CONTACTS_BY_USER, (user_id,))


@router.get("/confirm/{token}")
def confirm_contact(token: str):
    contact_id: int | None = Token.ValidateContactConfirmation(token)
    if contact_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    cursor.execute(Queries.CONFIRM_CONTACT, (contact_id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    cursor.commit()

    return {"message": "Contact confirmed successfully"}


@router.put("/{contact_id}")
def update_contact(contact_id: int, data: ContactUpdate, user_id: int = Depends(current_user)):
    fields: dict = data.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields were provided to update")

    set_clause: str = ", ".join(f"{field} = %s" for field in fields)
    values: tuple = tuple(fields.values()) + (contact_id, user_id)

    cursor.execute(f"UPDATE contacts SET {set_clause} WHERE id = %s AND user_id = %s;", values)
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    cursor.commit()

    rows: list[dict] = cursor.execute(
        "SELECT id, name, phone, email, confirmed FROM contacts WHERE id = %s;",
        (contact_id,)
    )
    return rows[0]
