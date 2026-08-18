import base64
import hashlib
import hmac
import json
from pathlib import Path

import httpx
from jinja2 import Environment, FileSystemLoader

from modules.credentials import get_credentials
from modules.logs        import get_logger

_credentials: dict = get_credentials()['whatsapp']
_logger = get_logger(__name__)

_API_BASE: str = "https://api.twilio.com/2010-04-01"

_jinja_env: Environment = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parent.parent / "templates" / "whatsapp"),
)


class WhatsAppNotSentError(Exception):
    pass


def _render(template: str, context: dict) -> str:
    return _jinja_env.get_template(f"{template}.txt.j2").render(**context)


def _to_address(phone: str) -> str:
    number: str = phone if phone.startswith("+") else f"+{phone}"
    return f"whatsapp:{number}"


def _content_variables(context: dict) -> str:
    return json.dumps({
        "1": str(context.get("user_name", "")),
        "2": str(context.get("timestamp", "")),
        "3": str(context.get("map_url", "")),
    })


def is_configured() -> bool:
    return bool(_credentials['account_sid'] and _credentials['auth_token'] and _credentials['from'])


def validate_signature(signature: str | None, url: str, params: dict) -> bool:
    auth_token: str | None = _credentials['auth_token']
    if not auth_token:
        return False
    payload: str = url
    for key in sorted(params):
        payload += key + params[key]
    digest: bytes = hmac.new(auth_token.encode(), payload.encode("utf-8"), hashlib.sha1).digest()
    expected: str = base64.b64encode(digest).decode()
    return hmac.compare_digest(expected, signature or "")


class WhatsApp:
    @staticmethod
    async def Send(phone: str, template: str, context: dict) -> None:
        await WhatsApp.SendBulk(template, [(phone, context)])

    @staticmethod
    async def SendBulk(template: str, recipients: list[tuple[str, dict]]) -> None:
        if not _credentials['enabled']:
            for phone, _ in recipients:
                _logger.info(f"[whatsapp dry-run] would send '{template}' to {phone}")
            return

        if not is_configured():
            raise WhatsAppNotSentError("Twilio WhatsApp is not configured")

        account_sid: str = _credentials['account_sid']
        sender: str = _credentials['from']
        template_sid: str | None = _credentials['template_sid']
        url: str = f"{_API_BASE}/Accounts/{account_sid}/Messages.json"

        failed: list[str] = []
        async with httpx.AsyncClient(timeout=10, auth=(account_sid, _credentials['auth_token'])) as client:
            for phone, context in recipients:
                data: dict = {"From": sender, "To": _to_address(phone)}
                if template_sid:
                    data["ContentSid"] = template_sid
                    data["ContentVariables"] = _content_variables(context)
                else:
                    data["Body"] = _render(template, context)
                try:
                    response = await client.post(url, data=data)
                    if response.status_code not in (200, 201):
                        _logger.error(f"Twilio rejected '{template}' to {phone}: {response.text}")
                        failed.append(phone)
                except httpx.HTTPError as e:
                    _logger.error(f"Could not reach Twilio for {phone}: {e}")
                    failed.append(phone)

        sent: int = len(recipients) - len(failed)
        _logger.info(f"Sent '{template}' bulk WhatsApp message to {sent}/{len(recipients)} recipients")
        if failed:
            raise WhatsAppNotSentError(f"Could not notify: {', '.join(failed)}")
