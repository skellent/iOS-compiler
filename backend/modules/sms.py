from pathlib import Path

import httpx
from jinja2 import Environment, FileSystemLoader

from modules.credentials import get_credentials
from modules.logs        import get_logger

_credentials: dict = get_credentials()['sms']
_logger = get_logger(__name__)

_API_BASE: str = "https://api.twilio.com/2010-04-01"

_jinja_env: Environment = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parent.parent / "templates" / "sms"),
)


class SmsNotSentError(Exception):
    pass


def _render(template: str, context: dict) -> str:
    return _jinja_env.get_template(f"{template}.txt.j2").render(**context)


def _to_address(phone: str) -> str:
    return phone if phone.startswith("+") else f"+{phone}"


def is_configured() -> bool:
    return bool(_credentials['account_sid'] and _credentials['auth_token'] and _credentials['from'])


class Sms:
    @staticmethod
    async def Send(phone: str, template: str, context: dict) -> None:
        await Sms.SendBulk(template, [(phone, context)])

    @staticmethod
    async def SendBulk(template: str, recipients: list[tuple[str, dict]]) -> None:
        if not _credentials['enabled']:
            for phone, _ in recipients:
                _logger.info(f"[sms dry-run] would send '{template}' to {phone}")
            return

        if not is_configured():
            raise SmsNotSentError("Twilio SMS is not configured")

        account_sid: str = _credentials['account_sid']
        sender: str = _credentials['from']
        url: str = f"{_API_BASE}/Accounts/{account_sid}/Messages.json"

        failed: list[str] = []
        async with httpx.AsyncClient(timeout=10, auth=(account_sid, _credentials['auth_token'])) as client:
            for phone, context in recipients:
                data: dict = {"From": sender, "To": _to_address(phone), "Body": _render(template, context)}
                try:
                    response = await client.post(url, data=data)
                    if response.status_code not in (200, 201):
                        _logger.error(f"Twilio rejected SMS '{template}' to {phone} [status={response.status_code}]: {response.text}")
                        failed.append(phone)
                except httpx.HTTPError as e:
                    _logger.error(f"Could not reach Twilio for {phone}: {e}")
                    failed.append(phone)

        sent: int = len(recipients) - len(failed)
        _logger.info(f"Sent '{template}' bulk SMS to {sent}/{len(recipients)} recipients")
        if failed:
            raise SmsNotSentError(f"Could not notify: {', '.join(failed)}")
