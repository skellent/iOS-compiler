from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends

from modules.mail         import Mail
from modules.cursor       import Queries
from modules.db           import cursor
from modules.dependencies import current_user
from modules.types        import Alert

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", status_code=201)
def create_alert(data: Alert, background_tasks: BackgroundTasks, user_id: int = Depends(current_user)):
    cursor.execute(Queries.INSERT_ALERT, (user_id, data.latitude, data.longitude))
    cursor.commit()

    user_rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    contacts: list[dict] = cursor.execute(Queries.SELECT_CONFIRMED_CONTACTS_BY_USER, (user_id,))

    recipients: list[tuple[str, dict]] = [
        (
            contact["email"],
            {
                "contact_name": contact["name"],
                "user_name":    user_rows[0]["name"],
                "user_phone":   user_rows[0]["phone"],
                "timestamp":    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "latitude":     data.latitude,
                "longitude":    data.longitude,
                "map_url":      f"https://www.google.com/maps?q={data.latitude},{data.longitude}",
            },
        )
        for contact in contacts if contact["email"]
    ]

    if recipients:
        background_tasks.add_task(
            Mail.SendBulk,
            f"Panic alert from {user_rows[0]['name']}",
            "panic_alert",
            recipients,
        )

    return {"Skellent": "Success!"}
