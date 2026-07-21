# `modules/dependencies.py`

## Purpose

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from modules.token import Token

_security = HTTPBearer()


def current_user(credentials: HTTPAuthorizationCredentials = Depends(_security)) -> int:
    payload: dict | None = Token.Validate(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return int(payload["sub"])
```

This module defines `current_user`, a **FastAPI dependency**: a function any endpoint can request as a parameter to require that the request come with a valid JWT (see `token.md`), and to directly obtain the authenticated user's `id`, without having to repeat the "read the header, validate the token, extract the `id`" logic in every protected endpoint.

## What `Depends` is, and why `current_user()` isn't called directly

`Depends(current_user)` isn't a normal function call. It's an instruction to FastAPI: "before running this endpoint, you run `current_user`, resolve whatever it needs (in this case, the `Authorization` header itself), and pass me the result as an argument." This is what lets an endpoint like `GET /users/me` (see `routers.md`) be declared like this:

```python
@router.get("/me")
def get_current_user(user_id: int = Depends(current_user)):
    ...
```

and directly receive an `int` with the user's `id`, without a single line of its own dedicated to reading tokens: if the token is missing or invalid, the endpoint function doesn't even get to run — FastAPI stops the flow at the dependency and responds with the error first. It's the same mechanism, in spirit, as Pydantic's automatic validation (see `types.md`): moving a cross-cutting responsibility (authentication) out of each endpoint's body and into the function's signature, where it's impossible to forget by accident.

## What `HTTPBearer` is, and where `credentials.credentials` comes from

```python
_security = HTTPBearer()
```

`HTTPBearer` is a FastAPI class that knows how to read the standard `Authorization: Bearer <token>` HTTP header. When used as a dependency (`Depends(_security)`), FastAPI takes care of:

1. Looking for the `Authorization` header in the request.
2. Verifying it has the `Bearer <something>` format (if the header is missing, or doesn't have that format, FastAPI automatically responds `401 Unauthorized` with the message `"Not authenticated"`, with no work needed from this code).
3. Wrapping the result in an `HTTPAuthorizationCredentials` object, whose `.credentials` attribute is the token itself (the part after `Bearer `).

`current_user` doesn't validate the header's *format* — `HTTPBearer` already did that before the function even runs. All that's left for it to do is take `credentials.credentials` (the raw token) and pass it to `Token.Validate` (see `token.md`) to confirm that, besides having the right format, it's a genuine, still-valid token.

The leading underscore in `_security` follows the same convention as `_secret` in `token.md`: it's an internal detail of this module — no one outside it should need the `HTTPBearer` object itself, only the `current_user` dependency that uses it internally.

## Why this lives in its own module instead of inside each router

`current_user` is used by all three endpoints in `users.py` and all three in `contacts.py` (see `routers.md`) — it's, after `cursor` (see `db.md`), the second most shared piece across routers. Putting it in its own module keeps every file in `modules/routers/` from having to redefine its own version of "read and validate the token," and makes explicit that authentication is a cross-cutting concern, not something that belongs to a single resource.

## Diagram: from the HTTP request to `user_id`

```mermaid
sequenceDiagram
    participant Client
    participant FastAPI
    participant HTTPBearer
    participant current_user as current_user()
    participant Token as Token.Validate
    participant Endpoint as protected endpoint

    Client->>FastAPI: GET /users/me<br/>Authorization: Bearer &lt;token&gt;
    FastAPI->>HTTPBearer: read Authorization header
    alt header missing or malformed
        HTTPBearer-->>Client: 401 Not authenticated
    else header present
        HTTPBearer->>current_user: HTTPAuthorizationCredentials
        current_user->>Token: Validate(credentials.credentials)
        alt invalid or expired token
            Token-->>current_user: None
            current_user-->>Client: 401 Invalid or expired token
        else valid token
            Token-->>current_user: payload (includes sub)
            current_user->>Endpoint: user_id (int)
            Endpoint-->>Client: 200 + data
        end
    end
```

## Relationship with the rest of the backend

`modules/routers/users.py` and `modules/routers/contacts.py` (see `routers.md`) import `current_user` and use it as `Depends(current_user)` in every endpoint that must belong to an authenticated user. `modules/routers/auth.py` is the only deliberate exception: neither `POST /auth/register` nor `POST /auth/login` can require a token, because their whole purpose is, precisely, to obtain one.
