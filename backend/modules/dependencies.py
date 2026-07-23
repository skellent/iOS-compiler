from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from modules.token import Token

_security = HTTPBearer()


def current_user(credentials: HTTPAuthorizationCredentials = Depends(_security)) -> int:
    payload: dict | None = Token.Validate(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return int(payload["sub"])
