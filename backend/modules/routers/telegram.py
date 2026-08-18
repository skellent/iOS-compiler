import secrets as _secrets

from fastapi import APIRouter, Header, HTTPException, Request

from modules.credentials import get_credentials
from modules.cursor       import Queries
from modules.db           import cursor
from modules.logs         import get_logger
from modules.telegram     import Telegram

router = APIRouter(prefix="/telegram", tags=["telegram"])

_WEBHOOK_SECRET: str | None = get_credentials()['telegram']['webhook_secret']
_logger = get_logger(__name__)


async def _handle_update(update: dict) -> None:
    message: dict = update.get("message") or {}
    text: str = (message.get("text") or "").strip()
    chat_id: int | None = (message.get("chat") or {}).get("id")

    if chat_id is None:
        _logger.info(f"Telegram webhook: update {update.get('update_id')} has no chat id, ignored")
        return

    if not text.startswith("/start"):
        _logger.info(f"Telegram webhook: message from chat {chat_id} is not a /start command, ignored")
        return

    parts: list[str] = text.split(maxsplit=1)
    token: str = parts[1].strip() if len(parts) > 1 else ""
    if not token:
        _logger.info(f"Telegram webhook: /start without a link token from chat {chat_id}")
        await Telegram.Send(chat_id, "telegram_link_invalid", {})
        return

    rows: list[dict] = cursor.execute(Queries.SELECT_CONTACT_BY_TELEGRAM_TOKEN, (token,))
    if not rows:
        _logger.warning(f"Telegram webhook: no contact matches the link token from chat {chat_id} (expired or already used)")
        await Telegram.Send(chat_id, "telegram_link_invalid", {})
        return

    contact: dict = rows[0]
    cursor.execute(Queries.CONFIRM_CONTACT_TELEGRAM, (chat_id, contact["id"]))
    cursor.commit()
    _logger.info(f"Contact {contact['id']} linked Telegram chat {chat_id}")

    await Telegram.Send(chat_id, "telegram_linked", {"user_name": contact["user_name"]})


@router.post("/webhook")
async def telegram_webhook(request: Request, x_telegram_bot_api_secret_token: str | None = Header(default=None)):
    if _WEBHOOK_SECRET and not _secrets.compare_digest(
        x_telegram_bot_api_secret_token or "", _WEBHOOK_SECRET
    ):
        _logger.warning("Telegram webhook: rejected a request with a missing or invalid secret token")
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    try:
        update: dict = await request.json()
    except Exception:
        _logger.warning("Telegram webhook: received a body that is not valid JSON")
        return {"ok": True}

    _logger.info(f"Telegram webhook: received update {update.get('update_id')}")
    try:
        await _handle_update(update)
    except Exception as e:
        _logger.exception(f"Error handling Telegram webhook: {e}")

    return {"ok": True}
