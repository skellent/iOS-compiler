from slowapi import Limiter
from slowapi.util import get_remote_address

from modules.dependencies import current_user

# Per-IP by default. Behind nginx this needs the proxy to set X-Forwarded-For and
# uvicorn to be run with --proxy-headers, otherwise every request looks like it
# comes from the proxy itself and the limits apply to all users at once.
limiter = Limiter(key_func=get_remote_address)


def user_or_ip(request) -> str:
    """
    Rate-limit key for authenticated endpoints: the user id when the request
    carries a valid session token, the client IP otherwise. Keeps one user on a
    shared/NAT'd network from consuming everyone else's allowance.
    """
    header: str = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        from modules.token import Token

        user_id = Token.ValidateSession(header.split(" ", 1)[1].strip())
        if user_id is not None:
            return f"user:{user_id}"
    return get_remote_address(request)


__all__ = ["limiter", "user_or_ip", "current_user"]
