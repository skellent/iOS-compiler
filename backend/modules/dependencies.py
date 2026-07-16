from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from modules.token import Token

_seguridad = HTTPBearer()


def usuario_actual(credenciales: HTTPAuthorizationCredentials = Depends(_seguridad)) -> int:
    payload: dict | None = Token.Validar(credenciales.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    return int(payload["sub"])
