from fastapi import APIRouter, Header, HTTPException, Request

from modules.credentials import get_credentials
from modules.cursor       import Queries
from modules.db           import cursor
from modules.telegram     import Telegram

router = APIRouter(prefix="/telegram", tags=["telegram"])

_WEBHOOK_SECRET: str | None = get_credentials()['telegram']['webhook_secret']


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

    await Telegram.Send(chat_id, "telegram_linked", {"user_name": contact["user_name"]})


@router.post("/webhook")
async def telegram_webhook(request: Request, x_telegram_bot_api_secret_token: str | None = Header(default=None)):
    # Telegram doesn't sign requests — this shared secret (set once via
    # Telegram.SetWebhook and echoed back on every call) is what tells a
    # genuine update apart from anyone who finds this URL and posts a forged
    # one. Only skipped if no secret is configured at all (local dev without
    # a real bot).
    if _WEBHOOK_SECRET and x_telegram_bot_api_secret_token != _WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    try:
        await _handle_update(await request.json())
    except Exception as e:
        # Telegram retries aggressively on anything but a 2xx response.
        # Whatever went wrong here, acknowledging the update is safer than
        # risking a retry storm over something a retry won't fix anyway.
        print(f"Error handling Telegram webhook: {e}")

    return {"ok": True}
