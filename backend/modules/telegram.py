from datetime import timedelta
from pathlib import Path

import httpx
from jinja2 import Environment, FileSystemLoader

from modules.credentials import get_credentials
from modules.logs        import get_logger

_credentials: dict = get_credentials()['telegram']
_logger = get_logger(__name__)

LINK_EXPIRATION: timedelta = timedelta(hours=24)

_jinja_env: Environment = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parent.parent / "templates" / "telegram"),
)

_API_BASE: str = "https://api.telegram.org"


class TelegramNotSentError(Exception):
    pass


def _render(template: str, context: dict) -> str:
    return _jinja_env.get_template(f"{template}.txt.j2").render(**context)


def _url(method: str) -> str:
    return f"{_API_BASE}/bot{_credentials['bot_token']}/{method}"


class Telegram:
    @staticmethod
    async def Send(chat_id: int, template: str, context: dict) -> None:
        text: str = _render(template, context)

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(_url("sendMessage"), json={"chat_id": chat_id, "text": text})

        if response.status_code != 200:
            _logger.error(f"Telegram rejected '{template}' message to chat {chat_id}: {response.text}")
            raise TelegramNotSentError(f"Telegram rejected message to chat {chat_id}: {response.text}")
        _logger.info(f"Sent '{template}' Telegram message to chat {chat_id}")

    @staticmethod
    async def SendBulk(template: str, recipients: list[tuple[int, dict]]) -> None:
        failed: list[str] = []

        async with httpx.AsyncClient(timeout=10) as client:
            for chat_id, context in recipients:
                text: str = _render(template, context)
                try:
                    response = await client.post(_url("sendMessage"), json={"chat_id": chat_id, "text": text})
                    if response.status_code != 200:
                        _logger.error(f"Telegram rejected '{template}' message to chat {chat_id}: {response.text}")
                        failed.append(str(chat_id))
                except httpx.HTTPError as e:
                    _logger.error(f"Could not reach Telegram for chat {chat_id}: {e}")
                    failed.append(str(chat_id))

        sent = len(recipients) - len(failed)
        _logger.info(f"Sent '{template}' bulk Telegram message to {sent}/{len(recipients)} chats")
        if failed:
            raise TelegramNotSentError(f"Could not notify chat ids: {', '.join(failed)}")

    @staticmethod
    async def SetWebhook(url: str) -> None:
        # Registering a null secret leaves the webhook unauthenticated, because the
        # endpoint skips the header check when no secret is configured. Refuse
        # instead of silently exposing it.
        secret: str | None = _credentials['webhook_secret']
        if not secret:
            raise TelegramNotSentError(
                "TELEGRAM_WEBHOOK_SECRET is not set. Set it, or unset TELEGRAM_BOT_TOKEN "
                "to run without Telegram — registering a webhook without a secret would "
                "leave POST /telegram/webhook open to anyone who finds the URL."
            )

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                _url("setWebhook"),
                json={"url": url, "secret_token": secret},
            )
        if response.status_code != 200 or not response.json().get("ok", False):
            _logger.error(f"Telegram rejected setWebhook for {url}: {response.text}")
            raise TelegramNotSentError(f"Telegram rejected setWebhook: {response.text}")

    @staticmethod
    async def GetWebhookInfo() -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(_url("getWebhookInfo"))
        if response.status_code != 200 or not response.json().get("ok", False):
            raise TelegramNotSentError(f"Telegram rejected getWebhookInfo: {response.text}")
        return response.json().get("result", {})
