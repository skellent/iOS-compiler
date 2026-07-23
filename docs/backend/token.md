# `modules/token.py`

## Purpose

```python
from datetime import datetime, timedelta, timezone

import jwt

from modules.credentials import get_credentials

ALGORITHM: str = "HS256"
EXPIRATION: timedelta = timedelta(days=30)

_secret: str = get_credentials()['jwt']['secret_key']

class Token:
    @staticmethod
    def Create(user_id: int) -> str:
        payload: dict = {
            "sub": str(user_id),
            "exp": datetime.now(timezone.utc) + EXPIRATION,
        }
        return jwt.encode(payload, _secret, algorithm=ALGORITHM)

    @staticmethod
    def Validate(token: str) -> dict | None:
        try:
            return jwt.decode(token, _secret, algorithms=[ALGORITHM])
        except jwt.InvalidTokenError:
            return None
```

This module isolates everything related to issuing and verifying JSON Web Tokens (JWT) behind a `Token` class with two static methods, following exactly the same pattern `Guard` (see `guard.md`) uses for passwords:

- `Token.Create(user_id)`: generates a signed token that represents "this request comes from this user, and is valid until this date."
- `Token.Validate(token)`: given a token that arrived in a request, verifies it's correctly signed and hasn't expired, and returns the content it carried inside (or `None` if something's off).

## What a JWT is, and why it solves the login problem

HTTP has no memory: every request is independent, and by default the server doesn't know whether two requests come from the same already-logged-in user. `POST /auth/login` (see `routers.md`) verifies the password once, but that result has to travel somehow with every following request so endpoints like `GET /users/me` know whose it is.

A JWT is the chosen solution for that: it's a text string with three parts (header, content or "payload," and signature) that the server generates once, at login, and the client resends on every following request inside the `Authorization: Bearer <token>` header (see `dependencies.md` for how that header is read). This project's content is deliberately minimal:

```python
payload: dict = {
    "sub": str(user_id),
    "exp": datetime.now(timezone.utc) + EXPIRATION,
}
```

- **`sub`** ("subject," a standard JWT claim name) is the `id` of the user who owns the token, converted to text because the JWT spec expects claims to be simple, JSON-serializable types, and the standard recommends `sub` be a string.
- **`exp`** ("expiration," also standard) is the date after which the token stops being valid. `jwt.decode` checks it automatically and raises an exception if it's already passed — no dates need to be compared by hand in this module.

## Why "stateless" (no one queries the database to validate a token)

What matters about a signed JWT is that its content **can't be altered without invalidating the signature**: if someone intercepts a token and changes its `sub` to impersonate another user, `jwt.decode` detects that the signature no longer matches the content and rejects it. That property is exactly what lets `Token.Validate` avoid asking the database, or any "active sessions" table, anything at all: if the signature is valid and hasn't expired, the `sub` is trusted to be who it says it is, with no SQL query involved. This is deliberately simpler than other alternatives (for example, storing sessions in a table and checking that table on every request) and is consistent with the rest of the project, which avoids extra infrastructure until it's actually needed (see also `main.md`, architecture section).

The tradeoff of this design is that a token can't be "invalidated" before it expires — there's no possible `DELETE /sessions/{token}`, because there's nowhere the server is keeping track of it. That's why `EXPIRATION` is fixed at 30 days: it's a balance between not forcing the user to log in constantly (the mobile app expects to keep a user logged in across sessions, the same way most phone apps do — logging in every 24 hours would be a poor experience for something meant to be ready at a moment's notice during an emergency) and not leaving a stolen token usable indefinitely. If the project ever needed to be able to revoke active sessions (for example, a "log out on all devices"), it would need to introduce server-side state, something deliberately not implemented today.

## Why `pyjwt` and not another library

Several Python libraries exist for JWT; `pyjwt` was chosen because the algorithm used here (`HS256`, HMAC with SHA-256) is symmetric — the same key (`JWT_SECRET_KEY`, see `credentials.md`) is used both to sign and to verify — and `pyjwt` covers that case without the extra asymmetric-cryptography dependencies this project doesn't need (alternatives like `python-jose` bring support for more algorithms and formats, at the cost of more weight and surface area).

## Why the secret is read once, at module level

```python
_secret: str = get_credentials()['jwt']['secret_key']
```

This line runs exactly once, the first time anything imports `modules.token` (the same modules-as-singleton mechanism explained in `db.md`). It avoids re-reading `.env` on every call to `Create` or `Validate` — the secret doesn't change while the process is running, so there's no reason to re-read it. The leading underscore (`_secret`) is a Python convention signaling "this is an internal module detail, don't import it from elsewhere" — whoever needs to create or validate tokens should do it through `Token`, not by reading `_secret` directly.

## Why `Validate` returns `None` instead of letting the exception propagate

`jwt.decode` raises different subclasses of `jwt.InvalidTokenError` depending on what went wrong (invalid signature, expired token, corrupt format, etc.). Whoever calls `Token.Validate` — today, only `modules/dependencies.py` (see `dependencies.md`) — doesn't care *which* of those problems happened, only whether the token is usable or not. That's why the method catches the base class `jwt.InvalidTokenError` (which covers every case above) and uniformly returns `None`, leaving it to the layer above to decide which HTTP code applies (in this case, `401 Unauthorized`).

## Relationship with the rest of the backend

`auth.py` calls `Token.Create(user_id)` at the end of a successful login, inside `POST /auth/login` (see `routers.md`). `modules/dependencies.py` calls `Token.Validate(token)` in the `current_user` dependency, which protects every endpoint that requires being authenticated (`GET`/`PUT /users/me`, `POST`/`GET`/`PUT /contacts`).

## `CreateContactConfirmation` and `ValidateContactConfirmation`

```python
CONTACT_CONFIRMATION_EXPIRATION: timedelta = timedelta(days=7)

@staticmethod
def CreateContactConfirmation(contact_id: int) -> str:
    payload: dict = {
        "contact_id": contact_id,
        "type": "contact_confirmation",
        "exp": datetime.now(timezone.utc) + CONTACT_CONFIRMATION_EXPIRATION,
    }
    return jwt.encode(payload, _secret, algorithm=ALGORITHM)

@staticmethod
def ValidateContactConfirmation(token: str) -> int | None:
    payload: dict | None = Token.Validate(token)
    if payload is None or payload.get("type") != "contact_confirmation":
        return None
    return int(payload["contact_id"])
```

These were added for the emergency-contact confirmation flow (see `mail.md` for the complete flow). It's a second type of JWT, with its own purpose, that coexists with the session token without replacing it or reusing its methods unchanged:

- **It's deliberately not the same payload shape as a session token**: a session token carries `{"sub": user_id, "exp": ...}`; a confirmation token carries `{"contact_id": ..., "type": "contact_confirmation", "exp": ...}`. The `"type"` claim is what keeps the two token types from being interchangeable — without it, a session token and a confirmation token signed with the same secret would be indistinguishable in shape, and one could slip through the endpoint meant for the other if the numeric values (`user_id` vs `contact_id`) happened to match. `ValidateContactConfirmation` rejects (returns `None`) any token that doesn't have exactly `"type": "contact_confirmation"`, even if it's correctly signed and hasn't expired.
- **It reuses `Token.Validate` for the decode step**, instead of reimplementing signature/expiration verification: `ValidateContactConfirmation` first calls `Validate` (which already knows how to catch `jwt.InvalidTokenError` and uniformly return `None`, see above) and only adds, on top of that, the check on the `"type"` claim. This avoids duplicating `jwt.decode` logic in two places in the same file.
- **Its own, independent expiration** (`7 days`, versus a session token's `30 days`): both are long-lived compared to what's typical for a JWT, but for different reasons — a session token stays valid for weeks so the app doesn't force the user to log in again while it's meant to be ready in an emergency (see above), while a confirmation token only needs to survive long enough for someone to notice an email in their inbox. `CONTACT_CONFIRMATION_EXPIRATION` is defined as its own constant, not derived from `EXPIRATION`, precisely so the two can move independently — nothing ties a future change to one to the other.

`modules/routers/contacts.py` is the only place that uses this second pair of methods: `POST /contacts` calls `CreateContactConfirmation` to generate the link sent by email (see `mail.md`), and `GET /contacts/confirm/{token}` calls `ValidateContactConfirmation` to decide whether it can set `confirmed = TRUE` (see `routers.md`).
