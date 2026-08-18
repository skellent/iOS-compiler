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
    text: str = message.get("text") or ""
    chat_id: int | None = (message.get("chat") or {}).get("id")

    if chat_id is None or not text.startswith("/start "):
        return

    token: str = text.split(maxsplit=1)[1].strip()
    rows: list[dict] = cursor.execute(Queries.SELECT_CONTACT_BY_TELEGRAM_TOKEN, (token,))
    if not rows:
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
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    try:
        await _handle_update(await request.json())
    except Exception as e:
        _logger.exception(f"Error handling Telegram webhook: {e}")

    return {"ok": True}
