# Authentication

Two independent building blocks: `Guard` (password hashing) and `Token` (JWT). Neither talks to the database — routers combine them with `Cursor` calls.

## Password hashing — `guard.py`

```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class Guard:
    Hash(password) -> str      # store this, never the plain password
    Verify(password, stored_hash) -> bool
```

`passlib`'s `CryptContext` handles bcrypt's salting; `deprecated="auto"` means if the scheme list ever grows, an old hash still verifies while new ones use the newest scheme — not currently exercised (there's only one scheme), but free to keep.

## JWTs — `token.py`

One secret (`JWT_SECRET_KEY`, see [`operations.md`](operations.md)), one algorithm (`HS256`), four token *purposes* distinguished by a `"type"` claim baked into the payload — so a confirmation link can never be replayed as a login session, even though both are "just a valid JWT":

| Purpose | Created by | Payload | Expires |
|---|---|---|---|
| Login session | `Token.Create` | `sub` (user id), `type=session` | 30 days |
| Account confirmation | `Token.CreateUserConfirmation` | `user_id`, `type=user_confirmation` | 24h |
| Contact confirmation | `Token.CreateContactConfirmation` | `contact_id`, `type=contact_confirmation` | 7 days |
| Alert-view link | `Token.CreateAlertNotificationView` | `notification_id`, `type=alert_notification_view` | 30 days |

`Token.Validate(token)` just checks the signature/expiry (`jwt.decode`, catching `InvalidTokenError`) and hands back the raw payload or `None`. Each `Validate<Purpose>` wrapper calls that, then additionally checks `payload["type"]` matches before trusting the id inside it — a contact-confirmation token presented where a login token is expected fails the type check, not just "any valid signature is good enough". The session token carries its own `type=session` claim for exactly this reason, so a confirmation or alert-view token can never stand in for a login.

The alert-view link outlives the confirmation links (30 days rather than hours): a contact may want to re-open the map well after an alert, but the link still expires so an old message can't reveal a location indefinitely.

## `current_user`: the auth dependency

```python
def current_user(credentials: HTTPAuthorizationCredentials = Depends(_security)) -> int:
    user_id = Token.ValidateSession(credentials.credentials)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id
```

FastAPI's `HTTPBearer` extracts the `Authorization: Bearer <token>` header; every protected route (`/users/me`, `/contacts`, `/alerts`, ...) declares `user_id: int = Depends(current_user)` and gets an `int` back, or the request never reaches the route body at all. `ValidateSession` enforces the `type=session` claim, so only a genuine login token opens a protected route — any other valid JWT is turned away with a `401`.

## Login sequence

```mermaid
sequenceDiagram
    participant App
    participant Auth as POST /auth/login
    participant Guard
    participant DB

    App->>Auth: email + password
    Auth->>DB: SELECT ... WHERE email = ?
    DB-->>Auth: row (password_hash, confirmed)
    Auth->>Guard: Verify(password, password_hash)
    alt wrong password or no such user
        Auth-->>App: 401
    else not confirmed
        Auth-->>App: 403
    else ok
        Auth->>Auth: Token.Create(user_id)
        Auth-->>App: access_token
    end
```

The app stores `access_token` via `@capacitor/preferences` (`app/src/lib/session.js`) and sends it as `Authorization: Bearer <token>` on every subsequent authenticated call (`app/src/lib/api.js`).

## Re-authentication for sensitive changes

Changing the account's email or password on `PUT /users/me` requires the account's **current password** in the request body (`current_password`), even though the session token is already valid. A 30-day bearer token is convenient but long-lived; requiring the password again means a stolen token alone can't quietly take over an account by swapping its login email or password. The check verifies `current_password` against the stored hash before applying the change — a missing password is a `400`, a wrong one a `403`. Editing only the name or phone doesn't ask for it. Whenever either sensitive field does change, a notice is emailed to the address on file *before* the change, so the legitimate owner learns of it even if the email itself was swapped (see [`notifications.md`](notifications.md)).
