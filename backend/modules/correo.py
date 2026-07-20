from email.message import EmailMessage
from pathlib import Path

import aiosmtplib
from jinja2 import Environment, FileSystemLoader, select_autoescape

from modules.credenciales import obtener_credenciales

_credenciales: dict = obtener_credenciales()['correo']

_entorno_jinja: Environment = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parent.parent / "templates" / "correo"),
    autoescape=select_autoescape(["html", "xml"]),
)


class CorreoNoEnviadoError(Exception):
    pass


def _armar_mensaje(destinatario: str, asunto: str, plantilla: str, contexto: dict) -> EmailMessage:
    cuerpo_html: str = _entorno_jinja.get_template(f"{plantilla}.html.j2").render(**contexto)
    cuerpo_texto: str = _entorno_jinja.get_template(f"{plantilla}.txt.j2").render(**contexto)

    mensaje = EmailMessage()
    mensaje["Subject"] = asunto
    mensaje["From"] = _credenciales['usuario']
    mensaje["To"] = destinatario
    mensaje.set_content(cuerpo_texto)
    mensaje.add_alternative(cuerpo_html, subtype="html")
    return mensaje


class Correo:
    @staticmethod
    async def Enviar(destinatario: str, asunto: str, plantilla: str, contexto: dict) -> None:
        mensaje: EmailMessage = _armar_mensaje(destinatario, asunto, plantilla, contexto)

        try:
            await aiosmtplib.send(
                mensaje,
                hostname=_credenciales['host'],
                port=_credenciales['port'],
                start_tls=True,
                username=_credenciales['usuario'],
                password=_credenciales['password'],
            )
        except aiosmtplib.SMTPException as e:
            raise CorreoNoEnviadoError(str(e)) from e

    @staticmethod
    async def EnviarMasivo(asunto: str, plantilla: str, destinatarios: list[tuple[str, dict]]) -> None:
        fallidos: list[str] = []

        async with aiosmtplib.SMTP(
            hostname=_credenciales['host'],
            port=_credenciales['port'],
            start_tls=True,
            username=_credenciales['usuario'],
            password=_credenciales['password'],
        ) as smtp:
            for destinatario, contexto in destinatarios:
                try:
                    mensaje: EmailMessage = _armar_mensaje(destinatario, asunto, plantilla, contexto)
                    await smtp.send_message(mensaje)
                except Exception:
                    fallidos.append(destinatario)

        if fallidos:
            raise CorreoNoEnviadoError(f"No se pudo notificar a: {', '.join(fallidos)}")
