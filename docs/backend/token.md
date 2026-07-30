# `modules/token.py`

## Purpose

```python
class Token:
    @staticmethod
    def Create(user_id: int) -> str: ...
    @staticmethod
    def Validate(token: str) -> dict | None: ...
    @staticmethod
    def CreateContactConfirmation(contact_id: int) -> str: ...
    @staticmethod
    def ValidateContactConfirmation(token: str) -> int | None: ...
    @staticmethod
    def CreateUserConfirmation(user_id: int) -> str: ...
    @staticmethod
    def ValidateUserConfirmation(token: str) -> int | None: ...
    @staticmethod
    def CreateAlertNotificationView(notification_id: int) -> str: ...
    @staticmethod
    def ValidateAlertNotificationView(token: str) -> int | None: ...
```

This module isolates everything related to issuing and verifying JSON Web Tokens (JWT) behind a `Token` class, following the same static "verb class" pattern as `Guard` (see `guard.md`). It issues four distinct kinds of token — a login session, an emergency-contact confirmation, a user-account confirmation, and an alert-notification view link — each with its own shape and its own expiration (or lack of one), sharing only the underlying signing/verification mechanics.

## What a JWT is, and why it solves the login problem

HTTP has no memory: every request is independent, and by default the server doesn't know whether two requests come from the same already-logged-in user. `POST /auth/login` (see `routers.md`) verifies the password once, but that result has to travel somehow with every following request so endpoints like `GET /users/me` know whose it is.

A JWT is the chosen solution for that: it's a text string with three parts (header, content or "payload," and signature) that the server generates once, at login, and the client resends on every following request inside the `Authorization: Bearer <token>` header (see `dependencies.md` for how that header is read).

## The session token

```python
ALGORITHM: str = "HS256"
EXPIRATION: timedelta = timedelta(days=30)

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

- **`sub`** ("subject," a standard JWT claim name) is the `id` of the user who owns the token, converted to text because the JWT spec expects claims to be simple, JSON-serializable types, and the standard recommends `sub` be a string.
- **`exp`** ("expiration," also standard) is the date after which the token stops being valid. `jwt.decode` checks it automatically and raises an exception if it's already passed — no dates need to be compared by hand in this module.
- **`Validate` returns `None` instead of letting the exception propagate**: `jwt.decode` raises different subclasses of `jwt.InvalidTokenError` depending on what went wrong (invalid signature, expired token, corrupt format). Whoever calls `Validate` doesn't care *which* of those happened, only whether the token is usable — so the method catches the base class (covering every case) and uniformly returns `None`, leaving it to the caller to decide the right HTTP status (`401`, in `modules/dependencies.py`).

`EXPIRATION` is fixed at 30 days: long enough that the mobile app can keep a user logged in across sessions the way most phone apps do (logging in every day would be a poor experience for something meant to be ready at a moment's notice during an emergency), while still not leaving a stolen token usable forever.

### Why "stateless" (no one queries the database to validate a token)

What matters about a signed JWT is that its content **can't be altered without invalidating the signature**: if someone intercepts a token and changes its `sub` to impersonate another user, `jwt.decode` detects that the signature no longer matches the content and rejects it. That property is exactly what lets `Validate` avoid asking the database, or any "active sessions" table, anything at all: if the signature is valid and hasn't expired, the `sub` is trusted to be who it says it is, with no SQL query involved.

The tradeoff is that a token can't be revoked before it expires — there's no possible `DELETE /sessions/{token}`, because there's nowhere the server is keeping track of it. A "log out on all devices" feature would need to introduce server-side state, something deliberately not implemented today.

### Why `pyjwt`

The algorithm used here (`HS256`, HMAC with SHA-256) is symmetric — the same key (`JWT_SECRET_KEY`, see `credentials.md`) signs and verifies — and `pyjwt` covers that case without the extra asymmetric-cryptography dependencies this project doesn't need.

### Why the secret is read once, at module level

```python
_secret: str = get_credentials()['jwt']['secret_key']
```

This line runs exactly once, the first time anything imports `modules.token` (the same modules-as-singleton mechanism explained in `db.md`). It avoids re-reading `.env` on every call — the secret doesn't change while the process is running. The leading underscore (`_secret`) signals "this is an internal module detail, don't import it from elsewhere"; whoever needs a token goes through `Token`, not `_secret` directly.

## Confirmation tokens: a second (and third) purpose for the same mechanism

```python
CONTACT_CONFIRMATION_EXPIRATION: timedelta = timedelta(days=7)
USER_CONFIRMATION_EXPIRATION: timedelta = timedelta(hours=24)

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

@staticmethod
def CreateUserConfirmation(user_id: int) -> str:
    payload: dict = {
        "user_id": user_id,
        "type": "user_confirmation",
        "exp": datetime.now(timezone.utc) + USER_CONFIRMATION_EXPIRATION,
    }
    return jwt.encode(payload, _secret, algorithm=ALGORITHM)

@staticmethod
def ValidateUserConfirmation(token: str) -> int | None:
    payload: dict | None = Token.Validate(token)
    if payload is None or payload.get("type") != "user_confirmation":
        return None
    return int(payload["user_id"])
```

An emergency contact confirming they agree to be notified, and a newly registered user confirming they own the email address they signed up with, both need a link that can be clicked from an email client with no session of any kind behind it. A JWT still fits that job well — it's still just "prove you're holding a specific, server-issued piece of paper" — but neither case can reuse a session token unchanged:

- **Each has its own payload shape and its own `"type"` claim.** A session token carries `{"sub": user_id, "exp": ...}`; a contact-confirmation token carries `{"contact_id": ..., "type": "contact_confirmation", "exp": ...}`; a user-confirmation token carries `{"user_id": ..., "type": "user_confirmation", "exp": ...}`. The `"type"` claim is what keeps the three from being interchangeable — without it, a session token and a confirmation token signed with the same secret could be indistinguishable in shape, and one could slip through the endpoint meant for the other if the numeric IDs happened to collide. Each `Validate*Confirmation` method rejects (returns `None`) any token that doesn't carry exactly its own `"type"`, even if it's correctly signed and hasn't expired.
- **Both reuse `Token.Validate` for the decode step** instead of reimplementing signature/expiration verification — each calls `Validate` first (which already catches `jwt.InvalidTokenError` and returns `None` uniformly) and only adds the `"type"` check on top. This avoids duplicating `jwt.decode` logic across three near-identical code paths in the same file.
- **Each has its own, independent expiration**, deliberately not derived from `EXPIRATION` or from each other: `CONTACT_CONFIRMATION_EXPIRATION` (7 days) only needs to survive long enough for someone to notice an email in their inbox and agree to receive alerts on someone else's behalf — not urgent, not time-sensitive. `USER_CONFIRMATION_EXPIRATION` (24 hours) is shorter on purpose: it's paired with `scripts/purge_unconfirmed_users.py` (see `scripts.md`), which deletes an account if it's still unconfirmed 24 hours after registering, so a confirmation link that claimed to stay valid longer than that would be quietly lying — the account it points to may already be gone.

`modules/routers/contacts.py` uses the contact-confirmation pair: `POST /contacts` calls `CreateContactConfirmation` to build the link sent by email, and `GET /contacts/confirm/{token}` calls `ValidateContactConfirmation` to decide whether it can set `confirmed = TRUE` (see `routers.md`, `mail.md`). `modules/routers/auth.py` uses the user-confirmation pair the same way: `POST /auth/register` calls `CreateUserConfirmation`, and `GET /auth/confirm/{token}` calls `ValidateUserConfirmation`.

## The alert-notification view token: the one that deliberately never expires

```python
@staticmethod
def CreateAlertNotificationView(notification_id: int) -> str:
    payload: dict = {
        "notification_id": notification_id,
        "type": "alert_notification_view",
    }
    return jwt.encode(payload, _secret, algorithm=ALGORITHM)

@staticmethod
def ValidateAlertNotificationView(token: str) -> int | None:
    payload: dict | None = Token.Validate(token)
    if payload is None or payload.get("type") != "alert_notification_view":
        return None
    return int(payload["notification_id"])
```

Same "verb pair" shape and the same `"type"`-claim discipline as the two confirmation flows above, with one deliberate difference: there's no `"exp"` claim at all. Every other token this module issues is meant to be used once, soon, by the person it was generated for — a session lasts 30 days, a confirmation link a matter of hours or days. This one is the `map_url` embedded in a panic-alert email or Telegram message (see `mail.md`, `telegram.md`): a contact might not open that message the day it arrives, and even if they do, the alert it points to stays a meaningful historical record in the dashboard (`GET /alerts`, see `routers.md`) for as long as the `alert_notifications` row itself exists (see `sql.md`) — there's no natural point at which the link should stop working while the record it points to is still there to look at.

This is a narrower tradeoff than it looks: unlike a session token, holding this JWT doesn't authenticate as anyone or expose anything beyond "which map coordinates to redirect to" (`GET /alerts/view/{token}`, see `routers.md`) — the `notification_id` it carries isn't sensitive on its own, and the endpoint that consumes it doesn't return the alert's owner's identity, only a `302` to Google Maps. `ValidateAlertNotificationView` follows the same `Token.Validate` → `"type"` check shape as `ValidateContactConfirmation`/`ValidateUserConfirmation`, just without an expiration ever entering into whether it still decodes successfully.

## Relationship with the rest of the backend

`auth.py` calls `Token.Create(user_id)` at the end of a successful login, and both `Token.CreateUserConfirmation`/`ValidateUserConfirmation` around registration and account confirmation. `contacts.py` calls `Token.CreateContactConfirmation`/`ValidateContactConfirmation` around adding and confirming an emergency contact. `alerts.py` calls `Token.CreateAlertNotificationView` once per notification row it creates (`POST /alerts`) and `Token.ValidateAlertNotificationView` when that link is opened (`GET /alerts/view/{token}`). `modules/dependencies.py` calls `Token.Validate(token)` in the `current_user` dependency, which protects every endpoint that requires being logged in.
