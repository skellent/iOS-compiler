from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends

from modules.mail         import Mail
from modules.cursor       import Queries
from modules.db           import cursor
from modules.dependencies import current_user
from modules.telegram     import Telegram
from modules.types        import Alert

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", status_code=201)
def create_alert(data: Alert, background_tasks: BackgroundTasks, user_id: int = Depends(current_user)):
    cursor.execute(Queries.INSERT_ALERT, (user_id, data.latitude, data.longitude))
    cursor.commit()

    user_rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    contacts: list[dict] = cursor.execute(Queries.SELECT_CONFIRMED_CONTACTS_BY_USER, (user_id,))

    context: dict = {
        "user_name":  user_rows[0]["name"],
        "user_phone": user_rows[0]["phone"],
        "user_email": user_rows[0]["email"],
        "timestamp":  datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "latitude":   data.latitude,
        "longitude":  data.longitude,
        "map_url":    f"https://www.google.com/maps?q={data.latitude},{data.longitude}",
    }

    # Email and Telegram are independent, parallel channels — a contact who
    # only linked Telegram (and never confirmed by email, or has no email at
    # all) still needs to hear about this, and vice versa.
    mail_recipients: list[tuple[str, dict]] = [
        (contact["email"], {"contact_name": contact["name"], **context})
        for contact in contacts if contact["email"]
    ]
    telegram_recipients: list[tuple[int, dict]] = [
        (contact["telegram_chat_id"], {"contact_name": contact["name"], **context})
        for contact in contacts if contact["telegram_chat_id"]
    ]

    if mail_recipients:
        background_tasks.add_task(
            Mail.SendBulk,
            f"Panic alert from {user_rows[0]['name']}",
            "panic_alert",
            mail_recipients,
        )

    if telegram_recipients:
        background_tasks.add_task(Telegram.SendBulk, "panic_alert", telegram_recipients)

    return {"Skellent": "Success!"}
