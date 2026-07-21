from email.message import EmailMessage
from pathlib import Path

import aiosmtplib
from jinja2 import Environment, FileSystemLoader, select_autoescape

from modules.credentials import get_credentials

_credentials: dict = get_credentials()['email']

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
    message["From"] = _credentials['user']
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
            raise MailNotSentError(str(e)) from e

    @staticmethod
    async def SendBulk(subject: str, template: str, recipients: list[tuple[str, dict]]) -> None:
        failed: list[str] = []

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
                except Exception:
                    failed.append(recipient)

        if failed:
            raise MailNotSentError(f"Could not notify: {', '.join(failed)}")
