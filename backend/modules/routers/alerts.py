from datetime import datetime

from fastapi            import APIRouter, BackgroundTasks, Depends
from fastapi.responses  import HTMLResponse, RedirectResponse

from modules.credentials  import get_credentials
from modules.mail         import Mail
from modules.cursor       import Queries
from modules.db           import cursor
from modules.dependencies import current_user
from modules.logs         import get_logger
from modules.pages        import Pages
from modules.telegram     import Telegram
from modules.token        import Token
from modules.types        import Alert

router = APIRouter(prefix="/alerts", tags=["alerts"])

_URL_BASE: str = get_credentials()['api_base_url']
_logger = get_logger(__name__)


def _create_notification(alert_id: int, contact_id: int, channel: str) -> int:
    cursor.execute(Queries.INSERT_ALERT_NOTIFICATION, (alert_id, contact_id, channel))
    cursor.commit()
    return cursor.lastrowid


def _view_url(notification_id: int) -> str:
    token: str = Token.CreateAlertNotificationView(notification_id)
    return f"{_URL_BASE}/alerts/view/{token}"


@router.post("", status_code=201)
def create_alert(data: Alert, background_tasks: BackgroundTasks, user_id: int = Depends(current_user)):
    cursor.execute(Queries.INSERT_ALERT, (user_id, data.latitude, data.longitude))
    cursor.commit()
    alert_id: int = cursor.lastrowid
    _logger.warning(f"Panic alert {alert_id} triggered by user {user_id} at {data.latitude},{data.longitude}")

    user_rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    contacts: list[dict] = cursor.execute(Queries.SELECT_CONFIRMED_CONTACTS_BY_USER, (user_id,))

    base_context: dict = {
        "user_name":  user_rows[0]["name"],
        "user_phone": user_rows[0]["phone"],
        "user_email": user_rows[0]["email"],
        "timestamp":  datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "latitude":   data.latitude,
        "longitude":  data.longitude,
    }

    # Email and Telegram are independent, parallel channels — a contact who
    # only linked Telegram (and never confirmed by email, or has no email at
    # all) still needs to hear about this, and vice versa. Each recipient
    # gets its own alert_notifications row (and therefore its own map_url,
    # see _view_url) so a click on that specific link can be attributed to
    # that specific contact and channel — see docs/backend/routers.md.
    mail_recipients: list[tuple[str, dict]] = []
    telegram_recipients: list[tuple[int, dict]] = []

    for contact in contacts:
        if contact["email"]:
            notification_id: int = _create_notification(alert_id, contact["id"], "email")
            mail_recipients.append((contact["email"], {
                "contact_name": contact["name"],
                "map_url": _view_url(notification_id),
                **base_context,
            }))
        if contact["telegram_chat_id"]:
            notification_id: int = _create_notification(alert_id, contact["id"], "telegram")
            telegram_recipients.append((contact["telegram_chat_id"], {
                "contact_name": contact["name"],
                "map_url": _view_url(notification_id),
                **base_context,
            }))

    if mail_recipients:
        background_tasks.add_task(
            Mail.SendBulk,
            f"Panic alert from {user_rows[0]['name']}",
            "panic_alert",
            mail_recipients,
        )

    if telegram_recipients:
        background_tasks.add_task(Telegram.SendBulk, "panic_alert", telegram_recipients)

    _logger.info(
        f"Alert {alert_id}: notifying {len(mail_recipients)} contact(s) by email, "
        f"{len(telegram_recipients)} by Telegram"
    )

    return {"Skellent": "Success!"}


@router.get("")
def list_alerts(user_id: int = Depends(current_user)):
    alerts: list[dict] = cursor.execute(Queries.SELECT_ALERTS_BY_USER, (user_id,))
    for alert in alerts:
        alert["notifications"] = cursor.execute(Queries.SELECT_ALERT_NOTIFICATIONS_BY_ALERT, (alert["id"],))
    return alerts


@router.get("/view/{token}")
def view_alert_notification(token: str):
    notification_id: int | None = Token.ValidateAlertNotificationView(token)
    if notification_id is None:
        _logger.warning("Alert view link used with an invalid token")
        return HTMLResponse(
            Pages.Render("confirmation_result", {
                "success": False,
                "message": "This link is invalid.",
            }),
            status_code=401,
        )

    rows: list[dict] = cursor.execute(Queries.SELECT_ALERT_NOTIFICATION_BY_ID, (notification_id,))
    if not rows:
        _logger.warning(f"Alert view link used for notification {notification_id}, which no longer exists")
        return HTMLResponse(
            Pages.Render("confirmation_result", {
                "success": False,
                "message": "This alert no longer exists.",
            }),
            status_code=404,
        )

    notification: dict = rows[0]
    if notification["viewed_at"] is None:
        cursor.execute(Queries.MARK_ALERT_NOTIFICATION_VIEWED, (notification_id,))
        cursor.commit()
        _logger.info(f"Alert notification {notification_id} viewed for the first time")

    map_url: str = f"https://www.google.com/maps?q={notification['latitude']},{notification['longitude']}"
    return RedirectResponse(url=map_url, status_code=302)
