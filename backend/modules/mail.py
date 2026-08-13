from email.message import EmailMessage
from pathlib import Path

import aiosmtplib
from jinja2 import Environment, FileSystemLoader, select_autoescape

from modules.credentials import get_credentials
from modules.logs        import get_logger

_credentials: dict = get_credentials()['email']
_logger = get_logger(__name__)

_jinja_env: Environment = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parent.parent / "templates" / "mail"),
    autoescape=select_autoescape(["html", "xml"]),
)


class MailNotSentError(Exception):
    pass


def _build_message(recipient: str, subject: str, template: str, context: dict) -> EmailMessage:
    html_body: str = _jinja_env.get_template(f"{template}.html.j2").render(**context)
    text_body: str = _jinja_env.get_template(f"{template}.txt.j2").render(**context)

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = _credentials['from']
    message["To"] = recipient
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")
    return message


class Mail:
    @staticmethod
    async def Send(recipient: str, subject: str, template: str, context: dict) -> None:
        message: EmailMessage = _build_message(recipient, subject, template, context)

        try:
            await aiosmtplib.send(
                message,
                hostname=_credentials['host'],
                port=_credentials['port'],
                start_tls=True,
                username=_credentials['user'],
                password=_credentials['password'],
            )
        except aiosmtplib.SMTPException as e:
            _logger.error(f"Could not send '{template}' email to {recipient}: {e}")
            raise MailNotSentError(str(e)) from e
        _logger.info(f"Sent '{template}' email to {recipient}")

    @staticmethod
    async def SendBulk(subject: str, template: str, recipients: list[tuple[str, dict]]) -> None:
        failed: list[str] = []

        try:
            async with aiosmtplib.SMTP(
                hostname=_credentials['host'],
                port=_credentials['port'],
                start_tls=True,
                username=_credentials['user'],
                password=_credentials['password'],
            ) as smtp:
                for recipient, context in recipients:
                    try:
                        message: EmailMessage = _build_message(recipient, subject, template, context)
                        await smtp.send_message(message)
                    except Exception as e:
                        _logger.error(f"Could not send '{template}' email to {recipient}: {e}")
                        failed.append(recipient)
        except aiosmtplib.SMTPException as e:
            # Connecting/logging in happens in __aenter__, before the
            # per-recipient loop above even starts — a bad password fails
            # here, not inside the loop's try/except, so without this it
            # would escape as a raw aiosmtplib exception instead of the
            # MailNotSentError every caller of SendBulk expects. Concretely:
            # alerts.py relies on SendBulk only ever raising MailNotSentError
            # to keep a broken mailbox from also skipping the Telegram
            # background task queued right after it (see routers.md).
            _logger.error(f"Could not send '{template}' bulk email: {e}")
            raise MailNotSentError(str(e)) from e

        sent = len(recipients) - len(failed)
        _logger.info(f"Sent '{template}' bulk email to {sent}/{len(recipients)} recipients")
        if failed:
            raise MailNotSentError(f"Could not notify: {', '.join(failed)}")
