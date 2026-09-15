import asyncio
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi            import APIRouter, BackgroundTasks, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.encoders    import jsonable_encoder
from fastapi.responses  import HTMLResponse
from pydantic            import ValidationError

from modules.credentials  import get_credentials
from modules.limiter      import limiter, user_or_ip
from modules.mail         import Mail, MailNotSentError
from modules.cursor       import Queries
from modules.db           import cursor
from modules.dependencies import current_user
from modules.logs         import get_logger
from modules.pages        import Pages
from modules.realtime     import alert_connections
from modules.telegram     import Telegram, TelegramNotSentError
from modules.token        import ALERT_PUBLISH_EXPIRATION, ALERT_VIEW_EXPIRATION, Token
from modules.types        import Alert, AlertCreated, AlertLocationUpdate
from modules.whatsapp     import WhatsApp, WhatsAppNotSentError
from modules.sms          import Sms, SmsNotSentError

router = APIRouter(prefix="/alerts", tags=["alerts"])
short_router = APIRouter(tags=["alerts"])

_URL_BASE: str = get_credentials()['api_base_url']
_MAP_CONFIG: dict = get_credentials()['map']
_TRACKING_DURATION: timedelta = ALERT_PUBLISH_EXPIRATION
_SHORT_TOKEN_BYTES: int = 16
_SHORT_TOKEN_LENGTH: int = 22
_SHORT_TOKEN_CHARS: frozenset[str] = frozenset(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
)
_logger = get_logger(__name__)


def _short_token_hash(token: str) -> bytes:
    return hashlib.sha256(token.encode("utf-8")).digest()


def _create_notification(alert_id: int, contact_id: int, contact_name: str, channel: str) -> tuple[int, str]:
    expires_at: datetime = (
        datetime.now(timezone.utc) + ALERT_VIEW_EXPIRATION
    ).replace(tzinfo=None)
    token: str = secrets.token_urlsafe(_SHORT_TOKEN_BYTES)
    cursor.execute(Queries.INSERT_ALERT_NOTIFICATION, (
        alert_id,
        contact_id,
        contact_name,
        channel,
        _short_token_hash(token),
        expires_at,
    ))
    cursor.commit()
    return cursor.lastrowid, token


def _short_view_url(token: str) -> str:
    return f"{_URL_BASE}/a/{token}"


def _notification_id_from_short_token(token: str) -> int | None:
    if len(token) != _SHORT_TOKEN_LENGTH or any(ch not in _SHORT_TOKEN_CHARS for ch in token):
        return None
    rows: list[dict] = cursor.execute(
        Queries.SELECT_ALERT_NOTIFICATION_ID_BY_SHORT_TOKEN_HASH,
        (_short_token_hash(token),),
    )
    return rows[0]["id"] if rows else None


def _owner_view_url(alert_id: int, user_id: int) -> str:
    token: str = Token.CreateAlertOwnerView(alert_id, user_id)
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

    created_at: datetime = datetime.now(timezone.utc)
    tracking_expires_at: datetime = created_at + _TRACKING_DURATION
    database_created_at: datetime = created_at.replace(tzinfo=None)
    database_expires_at: datetime = tracking_expires_at.replace(tzinfo=None)
    with cursor.transaction():
        cursor.execute(Queries.INSERT_ALERT, (
            user_id,
            database_created_at,
            data.latitude,
            data.longitude,
            database_expires_at,
            data.latitude,
            data.longitude,
            data.accuracy,
            data.speed,
            data.bearing,
            database_created_at,
        ))
        alert_id: int = cursor.lastrowid
        cursor.execute(Queries.INSERT_ALERT_LOCATION, (
            alert_id, 0, data.latitude, data.longitude, data.accuracy, data.speed, data.bearing, database_created_at,
        ))
    _logger.warning(f"Panic alert {alert_id} triggered by user {user_id} at {data.latitude},{data.longitude}")

    contacts: list[dict] = cursor.execute(Queries.SELECT_CONFIRMED_CONTACTS_BY_USER, (user_id,))

    base_context: dict = {
        "user_name":  user["name"],
        "user_phone": user["phone"],
        "user_email": user["email"],
        "timestamp":  datetime.now().strftime("%m/%d/%Y %H:%M:%S"),
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
            _, view_token = _create_notification(alert_id, contact["id"], contact["name"], "email")
            mail_recipients.append((contact["email"], {
                "contact_name": contact["name"],
                "map_url": _short_view_url(view_token),
                **base_context,
            }))
        if contact["telegram_chat_id"]:
            _, view_token = _create_notification(alert_id, contact["id"], contact["name"], "telegram")
            telegram_recipients.append((contact["telegram_chat_id"], {
                "contact_name": contact["name"],
                "map_url": _short_view_url(view_token),
                **base_context,
            }))
        if contact["whatsapp_enabled"] and contact["whatsapp_confirmed"]:
            _, view_token = _create_notification(alert_id, contact["id"], contact["name"], "whatsapp")
            whatsapp_recipients.append((contact["phone"], {
                "contact_name": contact["name"],
                "map_url": _short_view_url(view_token),
                **base_context,
            }))
        if contact["sms_enabled"]:
            _, view_token = _create_notification(alert_id, contact["id"], contact["name"], "sms")
            sms_recipients.append((contact["phone"], {
                "contact_name": contact["name"],
                "map_url": _short_view_url(view_token),
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
        "created_at": created_at,
        "notified_contacts": len(contacts),
        "channels": {
            "email": len(mail_recipients),
            "telegram": len(telegram_recipients),
            "whatsapp": len(whatsapp_recipients),
            "sms": len(sms_recipients),
        },
        "publisher_token": Token.CreateAlertPublisher(alert_id, user_id, tracking_expires_at),
        "tracking_expires_at": tracking_expires_at,
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
        alert["view_url"] = _owner_view_url(alert["id"], user_id)
    return alerts


def _invalid_view_response() -> HTMLResponse:
    return HTMLResponse(
        Pages.Render("confirmation_result", {
            "success": False,
            "message": "This link is invalid or has expired.",
        }),
        status_code=401,
    )


def _missing_alert_response() -> HTMLResponse:
    return HTMLResponse(
        Pages.Render("confirmation_result", {
            "success": False,
            "message": "This alert no longer exists.",
        }),
        status_code=404,
    )


def _live_alert_response(alert: dict, live_path: str, notification_id: int | None = None) -> HTMLResponse:
    if notification_id is not None and alert["viewed_at"] is None:
        cursor.execute(Queries.MARK_ALERT_NOTIFICATION_VIEWED, (notification_id,))
        cursor.commit()
        _logger.info(f"Alert notification {notification_id} viewed for the first time")

    response = HTMLResponse(Pages.Render("live_alert", {
        "live_path": live_path,
        "video_path": live_path.removesuffix("/live") + "/video",
        "user_name": alert["user_name"],
        "user_phone": alert["user_phone"],
        "tile_url": _MAP_CONFIG["tile_url"],
        "tile_attribution": _MAP_CONFIG["attribution"],
    }))
    response.headers["Cache-Control"] = "no-store"
    # Cross-origin tile requests receive only this site's origin, never the signed path.
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


def _view_video(alert: dict) -> dict:
    from modules.routers.videos import video_public_status
    return video_public_status(alert["alert_id"])


@router.get("/view/{token}/video")
def view_alert_video(token: str):
    notification_id = Token.ValidateAlertNotificationView(token)
    owner = Token.ValidateAlertOwnerView(token)
    if notification_id is None and owner is None:
        raise HTTPException(status_code=401, detail="Invalid or expired alert link")
    rows = cursor.execute(Queries.SELECT_ALERT_NOTIFICATION_BY_ID, (notification_id,)) if notification_id is not None else cursor.execute(Queries.SELECT_ALERT_VIEW_BY_OWNER, owner)
    if not rows:
        raise HTTPException(status_code=404, detail="Alert not found")
    return _view_video(rows[0])


@short_router.get("/a/{token}/video")
def view_alert_video_by_short_token(token: str):
    notification_id = _notification_id_from_short_token(token)
    if notification_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired alert link")
    rows = cursor.execute(Queries.SELECT_ALERT_NOTIFICATION_BY_ID, (notification_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Alert not found")
    return _view_video(rows[0])


@router.get("/view/{token}")
def view_alert_notification(token: str):
    notification_id: int | None = Token.ValidateAlertNotificationView(token)
    owner_credentials: tuple[int, int] | None = Token.ValidateAlertOwnerView(token)
    if notification_id is None and owner_credentials is None:
        _logger.warning("Alert view link used with an invalid token")
        return _invalid_view_response()

    if notification_id is not None:
        rows: list[dict] = cursor.execute(Queries.SELECT_ALERT_NOTIFICATION_BY_ID, (notification_id,))
    else:
        rows = cursor.execute(Queries.SELECT_ALERT_VIEW_BY_OWNER, owner_credentials)
    if not rows:
        _logger.warning("Alert view link points to an alert that no longer exists")
        return _missing_alert_response()

    return _live_alert_response(rows[0], f"/alerts/view/{token}/live", notification_id)


@short_router.get("/a/{token}", response_class=HTMLResponse)
def view_alert_by_short_token(token: str):
    notification_id: int | None = _notification_id_from_short_token(token)
    if notification_id is None:
        _logger.warning("Short alert view link used with an invalid or expired token")
        return _invalid_view_response()

    rows: list[dict] = cursor.execute(Queries.SELECT_ALERT_NOTIFICATION_BY_ID, (notification_id,))
    if not rows:
        _logger.warning("Short alert view link points to an alert that no longer exists")
        return _missing_alert_response()

    return _live_alert_response(rows[0], f"/a/{token}/live", notification_id)


def _publisher_state(alert_id: int, user_id: int) -> dict | None:
    cursor.execute(Queries.EXPIRE_ALERT_TRACKING, (alert_id,))
    rows: list[dict] = cursor.execute(Queries.SELECT_ALERT_PUBLISH_STATE, (alert_id, user_id))
    return rows[0] if rows else None


def _save_location(alert_id: int, user_id: int, location: AlertLocationUpdate) -> bool:
    recorded_at: datetime = location.recorded_at.astimezone(timezone.utc).replace(tzinfo=None)
    with cursor.transaction():
        cursor.execute(Queries.UPDATE_ALERT_LATEST_LOCATION, (
            location.latitude,
            location.longitude,
            location.accuracy,
            location.speed,
            location.bearing,
            location.sequence,
            recorded_at,
            alert_id,
            user_id,
            location.sequence,
        ))
        if cursor.rowcount == 0:
            return False
        cursor.execute(Queries.INSERT_ALERT_LOCATION, (
            alert_id,
            location.sequence,
            location.latitude,
            location.longitude,
            location.accuracy,
            location.speed,
            location.bearing,
            recorded_at,
        ))
    return True


def _stop_tracking(alert_id: int, user_id: int) -> bool:
    cursor.execute(Queries.STOP_ALERT_TRACKING, (alert_id, user_id))
    return cursor.rowcount > 0


def _notification_snapshot(notification_id: int, mark_viewed: bool = False) -> dict | None:
    rows: list[dict] = cursor.execute(Queries.SELECT_ALERT_NOTIFICATION_BY_ID, (notification_id,))
    if not rows:
        return None
    notification: dict = rows[0]
    cursor.execute(Queries.EXPIRE_ALERT_TRACKING, (notification["alert_id"],))
    if cursor.rowcount:
        rows = cursor.execute(Queries.SELECT_ALERT_NOTIFICATION_BY_ID, (notification_id,))
        notification = rows[0]
    if mark_viewed and notification["viewed_at"] is None:
        cursor.execute(Queries.MARK_ALERT_NOTIFICATION_VIEWED, (notification_id,))
    return _alert_snapshot(notification)


def _owner_snapshot(alert_id: int, user_id: int) -> dict | None:
    rows: list[dict] = cursor.execute(Queries.SELECT_ALERT_VIEW_BY_OWNER, (alert_id, user_id))
    if not rows:
        return None
    alert: dict = rows[0]
    cursor.execute(Queries.EXPIRE_ALERT_TRACKING, (alert_id,))
    if cursor.rowcount:
        rows = cursor.execute(Queries.SELECT_ALERT_VIEW_BY_OWNER, (alert_id, user_id))
        alert = rows[0]
    return _alert_snapshot(alert)


def _alert_snapshot(alert: dict) -> dict:
    points: list[dict] = cursor.execute(Queries.SELECT_ALERT_LOCATIONS, (alert["alert_id"],))
    return {
        "type": "snapshot",
        "alert_id": alert["alert_id"],
        "status": alert["status"],
        "created_at": alert["created_at"],
        "tracking_expires_at": alert["tracking_expires_at"],
        "tracking_ended_at": alert["tracking_ended_at"],
        "last_location_at": alert["last_location_at"],
        "latest": {
            "sequence": alert["latest_sequence"],
            "latitude": alert["latest_latitude"],
            "longitude": alert["latest_longitude"],
            "accuracy": alert["latest_accuracy"],
            "speed": alert["latest_speed"],
            "bearing": alert["latest_bearing"],
            "recorded_at": alert["last_location_at"],
        },
        "points": points,
    }


@router.post("/{alert_id}/stop", status_code=204)
async def stop_alert_tracking(alert_id: int, user_id: int = Depends(current_user)):
    state: dict | None = await run_in_threadpool(_publisher_state, alert_id, user_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    await run_in_threadpool(_stop_tracking, alert_id, user_id)
    await alert_connections.broadcast(alert_id, {"type": "status", "status": "ended"})


@router.websocket("/{alert_id}/track")
async def track_alert(websocket: WebSocket, alert_id: int):
    await websocket.accept()
    try:
        try:
            auth_message: dict = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        except (asyncio.TimeoutError, ValueError):
            await websocket.close(code=4401, reason="Authentication required")
            return

        credentials = Token.ValidateAlertPublisher(auth_message.get("token", "")) if auth_message.get("type") == "auth" else None
        if credentials is None or credentials[0] != alert_id:
            await websocket.close(code=4401, reason="Invalid or expired publisher token")
            return
        _, user_id = credentials

        state: dict | None = await run_in_threadpool(_publisher_state, alert_id, user_id)
        if state is None or state["status"] != "active":
            await websocket.close(code=4409, reason="Tracking session is not active")
            return
        await websocket.send_json({"type": "ready", "latest_sequence": state["latest_sequence"]})

        while True:
            message: dict = await websocket.receive_json()
            message_type: str | None = message.get("type")
            if message_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            if message_type == "stop":
                await run_in_threadpool(_stop_tracking, alert_id, user_id)
                status_message = {"type": "status", "status": "ended"}
                await alert_connections.broadcast(alert_id, status_message)
                await websocket.send_json(status_message)
                await websocket.close(code=1000)
                return
            if message_type != "location":
                await websocket.send_json({"type": "error", "detail": "Unknown message type"})
                continue

            try:
                location = AlertLocationUpdate.model_validate(message)
            except ValidationError as error:
                await websocket.send_json({"type": "error", "detail": error.errors(include_url=False)})
                continue

            now: datetime = datetime.now(timezone.utc)
            if location.recorded_at > now + timedelta(minutes=2) or location.recorded_at < now - _TRACKING_DURATION:
                await websocket.send_json({"type": "error", "detail": "Location timestamp is outside the tracking window"})
                continue

            saved: bool = await run_in_threadpool(_save_location, alert_id, user_id, location)
            if not saved:
                state = await run_in_threadpool(_publisher_state, alert_id, user_id)
                if state is None or state["status"] != "active":
                    await websocket.send_json({"type": "status", "status": state["status"] if state else "ended"})
                    await websocket.close(code=4409, reason="Tracking session ended")
                    return
                await websocket.send_json({"type": "ack", "sequence": location.sequence, "duplicate": True})
                continue

            payload: dict = jsonable_encoder({"type": "location", **location.model_dump()})
            await alert_connections.broadcast(alert_id, payload)
            await websocket.send_json({"type": "ack", "sequence": location.sequence})
    except WebSocketDisconnect:
        _logger.info(f"Publisher disconnected from alert {alert_id}")
    except ValueError:
        await websocket.close(code=4400, reason="Malformed JSON message")


@router.websocket("/view/{token}/live")
async def view_alert_live(websocket: WebSocket, token: str):
    await websocket.accept()
    notification_id: int | None = Token.ValidateAlertNotificationView(token)
    owner_credentials: tuple[int, int] | None = Token.ValidateAlertOwnerView(token)
    if notification_id is None and owner_credentials is None:
        await websocket.close(code=4401, reason="Invalid or expired view token")
        return

    await _serve_alert_live(websocket, notification_id, owner_credentials)


@short_router.websocket("/a/{token}/live")
async def view_alert_live_by_short_token(websocket: WebSocket, token: str):
    await websocket.accept()
    notification_id: int | None = await run_in_threadpool(_notification_id_from_short_token, token)
    if notification_id is None:
        await websocket.close(code=4401, reason="Invalid or expired view token")
        return
    await _serve_alert_live(websocket, notification_id, None)


async def _serve_alert_live(websocket: WebSocket, notification_id: int | None,
                            owner_credentials: tuple[int, int] | None) -> None:

    if notification_id is not None:
        snapshot: dict | None = await run_in_threadpool(_notification_snapshot, notification_id, True)
    else:
        snapshot = await run_in_threadpool(_owner_snapshot, *owner_credentials)
    if snapshot is None:
        await websocket.close(code=4404, reason="Alert no longer exists")
        return

    alert_id: int = snapshot["alert_id"]
    await alert_connections.add_viewer(alert_id, websocket)
    await websocket.send_json(jsonable_encoder(snapshot))
    try:
        while True:
            message: dict = await websocket.receive_json()
            if message.get("type") == "ping":
                if notification_id is not None:
                    refreshed = await run_in_threadpool(_notification_snapshot, notification_id)
                else:
                    refreshed = await run_in_threadpool(_owner_snapshot, *owner_credentials)
                if refreshed is None:
                    await websocket.close(code=4404, reason="Alert no longer exists")
                    return
                await websocket.send_json({"type": "pong", "status": refreshed["status"]})
    except (WebSocketDisconnect, ValueError):
        pass
    finally:
        await alert_connections.remove_viewer(alert_id, websocket)
