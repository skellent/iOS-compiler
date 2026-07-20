from datetime import datetime, timedelta, timezone

import jwt

from modules.credenciales import obtener_credenciales

ALGORITMO: str = "HS256"
EXPIRACION: timedelta = timedelta(hours=24)
EXPIRACION_CONFIRMACION_CONTACTO: timedelta = timedelta(days=7)

_secreto: str = obtener_credenciales()['jwt']['secret_key']

class Token:
    @staticmethod
    def Crear(id_usuario: int) -> str:
        payload: dict = {
            "sub": str(id_usuario),
            "exp": datetime.now(timezone.utc) + EXPIRACION,
        }
        return jwt.encode(payload, _secreto, algorithm=ALGORITMO)

    @staticmethod
    def Validar(token: str) -> dict | None:
        try:
            return jwt.decode(token, _secreto, algorithms=[ALGORITMO])
        except jwt.InvalidTokenError:
            return None

    @staticmethod
    def CrearConfirmacionContacto(id_contacto: int) -> str:
        payload: dict = {
            "contacto_id": id_contacto,
            "tipo": "confirmacion_contacto",
            "exp": datetime.now(timezone.utc) + EXPIRACION_CONFIRMACION_CONTACTO,
        }
        return jwt.encode(payload, _secreto, algorithm=ALGORITMO)

    @staticmethod
    def ValidarConfirmacionContacto(token: str) -> int | None:
        payload: dict | None = Token.Validar(token)
        if payload is None or payload.get("tipo") != "confirmacion_contacto":
            return None
        return int(payload["contacto_id"])
