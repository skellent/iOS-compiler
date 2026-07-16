from datetime import datetime, timedelta, timezone

import jwt

from modules.credenciales import obtener_credenciales

ALGORITMO: str = "HS256"
EXPIRACION: timedelta = timedelta(hours=24)

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
