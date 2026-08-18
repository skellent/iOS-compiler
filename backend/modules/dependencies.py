from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from modules.token import Token

_security = HTTPBearer()


def current_user(credentials: HTTPAuthorizationCredentials = Depends(_security)) -> int:
    # ValidateSession also checks the token's "type" claim, so a confirmation or
    # alert-view token presented as a Bearer token is rejected with 401 instead of
    # getting past the signature check and raising a KeyError on "sub" (a 500).
    user_id: int | None = Token.ValidateSession(credentials.credentials)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id
