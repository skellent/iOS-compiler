from datetime import datetime

from fastapi            import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses  import HTMLResponse, RedirectResponse

from modules.credentials  import get_credentials
from modules.limiter      import limiter, user_or_ip
from modules.mail         import Mail, MailNotSentError
from modules.cursor       import Queries
from modules.db           import cursor
from modules.dependencies import current_user
from modules.logs         import get_logger
from modules.pages        import Pages
from modules.telegram     import Telegram, TelegramNotSentError
from modules.token        import Token
from modules.types        import Alert, AlertCreated
from modules.whatsapp     import WhatsApp, WhatsAppNotSentError
from modules.sms          import Sms, SmsNotSentError

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


# BackgroundTasks stops at the first exception, so a failure in one channel must not
# prevent the other from running. Both channels are wrapped for that reason — the
# mail one always was; the Telegram one used to raise straight out of the task.
async def _notify_by_mail(subject: str, template: str, recipients: list[tuple[str, dict]]) -> None:
    try:
        await Mail.SendBulk(subject, template, recipients)
    except MailNotSentError:
        pass


async def _notify_by_telegram(template: str, recipients: list[tuple[int, dict]]) -> None:
    try:
        await Telegram.SendBulk(template, recipients)
    except TelegramNotSentError:
        pass


async def _notify_by_whatsapp(template: str, recipients: list[tuple[str, dict]]) -> None:
    try:
        await WhatsApp.SendBulk(template, recipients)
    except WhatsAppNotSentError:
        pass


async def _notify_by_sms(template: str, recipients: list[tuple[str, dict]]) -> None:
    try:
        await Sms.SendBulk(template, recipients)
    except SmsNotSentError:
        pass


@router.post("", status_code=201, response_model=AlertCreated)
@limiter.limit("12/hour", key_func=user_or_ip)
def create_alert(request: Request, data: Alert, background_tasks: BackgroundTasks, user_id: int = Depends(current_user)):
    user_rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    if not user_rows:
        # A still-valid token for a deleted account, rather than an IndexError -> 500.
        raise HTTPException(status_code=404, detail="User not found")
    user: dict = user_rows[0]

    cursor.execute(Queries.INSERT_ALERT, (user_id, data.latitude, data.longitude))
    cursor.commit()
    alert_id: int = cursor.lastrowid
    _logger.warning(f"Panic alert {alert_id} triggered by user {user_id} at {data.latitude},{data.longitude}")

    contacts: list[dict] = cursor.execute(Queries.SELECT_CONFIRMED_CONTACTS_BY_USER, (user_id,))

    base_context: dict = {
        "user_name":  user["name"],
        "user_phone": user["phone"],
        "user_email": user["email"],
        "timestamp":  datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "latitude":   data.latitude,
        "longitude":  data.longitude,
    }

    mail_recipients: list[tuple[str, dict]] = []
    telegram_recipients: list[tuple[int, dict]] = []
    whatsapp_recipients: list[tuple[str, dict]] = []
    sms_recipients: list[tuple[str, dict]] = []

    for contact in contacts:
        # A contact is selected if EITHER channel is active, so the email branch must
        # re-check confirmed on its own: a Telegram-linked contact whose email is
        # unconfirmed (e.g. just edited, which resets confirmed) must not be emailed.
        if contact["email"] and contact["confirmed"]:
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
        if contact["whatsapp_enabled"] and contact["whatsapp_confirmed"]:
            notification_id: int = _create_notification(alert_id, contact["id"], "whatsapp")
            whatsapp_recipients.append((contact["phone"], {
                "contact_name": contact["name"],
                "map_url": _view_url(notification_id),
                **base_context,
            }))
        if contact["sms_enabled"]:
            notification_id: int = _create_notification(alert_id, contact["id"], "sms")
            sms_recipients.append((contact["phone"], {
                "contact_name": contact["name"],
                "map_url": _view_url(notification_id),
                **base_context,
            }))

    if mail_recipients:
        background_tasks.add_task(
            _notify_by_mail,
            f"Panic alert from {user['name']}",
            "panic_alert",
            mail_recipients,
        )

    if telegram_recipients:
        background_tasks.add_task(_notify_by_telegram, "panic_alert", telegram_recipients)

    if whatsapp_recipients:
        background_tasks.add_task(_notify_by_whatsapp, "panic_alert", whatsapp_recipients)

    if sms_recipients:
        background_tasks.add_task(_notify_by_sms, "panic_alert", sms_recipients)

    _logger.info(
        f"Alert {alert_id}: notifying {len(mail_recipients)} contact(s) by email, "
        f"{len(telegram_recipients)} by Telegram, {len(whatsapp_recipients)} by WhatsApp, "
        f"{len(sms_recipients)} by SMS"
    )

    return {
        "id": alert_id,
        "created_at": datetime.now(),
        "notified_contacts": len(contacts),
        "channels": {
            "email": len(mail_recipients),
            "telegram": len(telegram_recipients),
            "whatsapp": len(whatsapp_recipients),
            "sms": len(sms_recipients),
        },
    }


@router.get("")
def list_alerts(user_id: int = Depends(current_user)):
    alerts: list[dict] = cursor.execute(Queries.SELECT_ALERTS_BY_USER, (user_id,))
    if not alerts:
        return []

    # Two queries total instead of one per alert.
    notifications: list[dict] = cursor.execute(Queries.SELECT_ALERT_NOTIFICATIONS_BY_USER, (user_id,))
    by_alert: dict[int, list[dict]] = {}
    for notification in notifications:
        by_alert.setdefault(notification.pop("alert_id"), []).append(notification)

    for alert in alerts:
        alert["notifications"] = by_alert.get(alert["id"], [])
    return alerts


@router.get("/view/{token}")
def view_alert_notification(token: str):
    notification_id: int | None = Token.ValidateAlertNotificationView(token)
    if notification_id is None:
        _logger.warning("Alert view link used with an invalid token")
        return HTMLResponse(
            Pages.Render("confirmation_result", {
                "success": False,
                "message": "This link is invalid or has expired.",
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
