# `modules/routers/` — API endpoints

This directory holds all of the API's business logic, split across four files by the resource they belong to. Unlike the other backend modules, which each have their own `.md`, these are documented together in a single file — the same approach `sql.md` uses to group the three `queries/` scripts, because these are pieces that only make sense read together (they share the same dependencies and the same patterns).

Each file defines an `APIRouter` with a fixed prefix and exposes it as `router`, which `main.py` mounts with `app.include_router(...)` (see `main.md`):

| File            | Prefix       | Endpoints |
|------------------|---------------|-----------|
| `auth.py`        | `/auth`       | `POST /register`, `POST /login`, `GET /confirm/{token}` |
| `users.py`       | `/users`      | `GET /me`, `PUT /me` |
| `contacts.py`    | `/contacts`   | `POST /`, `GET /`, `GET /confirm/{token}`, `PUT /{contact_id}`, `DELETE /{contact_id}` |
| `alerts.py`      | `/alerts`     | `POST /` |

## Why `APIRouter` instead of putting it all in `main.py`

`APIRouter` is the FastAPI piece designed exactly for this: it allows declaring endpoints in a file separate from where the main `FastAPI()` instance lives, with its own route prefix and its own tags (used to visually group endpoints in the `/docs` automatic documentation), and then "attaching" them to the real application with `include_router`. It's what lets `main.py` stay barely ten lines (see `main.md`) even as the API grew to a dozen endpoints across four resources.

## `auth.py`

```python
router = APIRouter(prefix="/auth", tags=["auth"])

_URL_BASE: str = get_credentials()['api_base_url']
_APP_DEEP_LINK: str = get_credentials()['app_deep_link']
```

Groups everything about proving who you are: creating an account, exchanging credentials for a session token, and confirming an email address. `POST /register` and `GET /confirm/{token}` don't require `Depends(current_user)` for the same underlying reason (there's no session to require yet, or the caller isn't inside the app at all); `POST /login` doesn't either, since it's the endpoint that produces the token everything else needs.

### `POST /auth/register`

```python
@router.post("/register", status_code=201)
def register(data: User, background_tasks: BackgroundTasks):
    password_hash: str = Guard.Hash(data.password)
    try:
        cursor.execute(Queries.INSERT_USER, (data.name, data.phone, data.email, password_hash))
    except DuplicateRecordError:
        raise HTTPException(status_code=409, detail="Phone or email already registered")
    cursor.commit()
    user_id: int = cursor.lastrowid

    token: str = Token.CreateUserConfirmation(user_id)
    background_tasks.add_task(
        Mail.Send, data.email, "Confirm your Panic Switch account", "user_confirmation",
        {"user_name": data.name, "confirmation_url": f"{_URL_BASE}/auth/confirm/{token}"},
    )
    return {"Skellent": "Success!"}
```

`Guard.Hash` (see `guard.md`) hashes the password before the plain text ever touches the database. Registering an already-existing `phone` or `email` (both `UNIQUE` on `users`, see `sql.md`) is caught as `DuplicateRecordError` (see `cursor.md`) and turned into a `409 Conflict` — the client sent data that collides with an existing resource, not a server failure.

The new account starts unconfirmed (`users.confirmed` defaults to `FALSE`, see `sql.md`), so this endpoint immediately queues a confirmation email: `cursor.lastrowid` gives the just-inserted row's `id`, `Token.CreateUserConfirmation` (see `token.md`) turns it into a single-purpose JWT, and `background_tasks.add_task` sends the email without making the caller wait for SMTP (see `mail.md` for why background tasks are used throughout this codebase for outgoing email). The response arrives as soon as the row is committed — before the email has even started sending.

### `POST /auth/login`

```python
@router.post("/login")
def login(data: UserLogin):
    rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_EMAIL, (data.email,))
    if not rows or not Guard.Verify(data.password, rows[0]["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not rows[0]["confirmed"]:
        raise HTTPException(status_code=403, detail="Please confirm your email before logging in")

    token: str = Token.Create(rows[0]["id"])
    return {"access_token": token, "token_type": "bearer"}
```

Two checks, in a deliberate order:

1. `if not rows or not Guard.Verify(...)`: a single condition covers both "the email doesn't exist" and "the password doesn't match," and both cases respond with exactly the same `401` and the same generic message. If the message differed depending on which of the two failed, anyone could use the endpoint to discover which emails are registered by trying them one by one (a user-enumeration attack). `not rows or ...` also short-circuits before ever indexing `rows[0]` when there's no row to index.
2. Only once the credentials themselves check out does the endpoint look at `confirmed`. Checking this second (not first) means a wrong password on an unconfirmed account still reports "incorrect email or password," not "please confirm your email" — the latter would confirm to an attacker that the email/password pair they just tried was actually correct, just blocked by a separate gate.

If both checks pass, `Token.Create` (see `token.md`) signs a 30-day session JWT.

### `GET /auth/confirm/{token}`

```python
@router.get("/confirm/{token}", response_class=HTMLResponse)
def confirm_user(token: str):
    user_id: int | None = Token.ValidateUserConfirmation(token)
    if user_id is None:
        return HTMLResponse(Pages.Render("confirmation_result", {
            "success": False,
            "message": "This confirmation link is invalid or has expired.",
        }), status_code=401)

    cursor.execute(Queries.CONFIRM_USER, (user_id,))
    if cursor.rowcount == 0:
        return HTMLResponse(Pages.Render("confirmation_result", {
            "success": False,
            "message": "This account no longer exists, so there's nothing left to confirm.",
        }), status_code=404)
    cursor.commit()

    return HTMLResponse(Pages.Render("app_redirect", {"deep_link": _APP_DEEP_LINK}))
```

The other end of `POST /register`'s email. Whoever hits this endpoint is a person who just clicked a link in their inbox, not an API client, so it responds with rendered HTML (`modules/pages.py`, see `pages.md`) instead of JSON — same reasoning as `GET /contacts/confirm/{token}` below. `Token.ValidateUserConfirmation` (see `token.md`) rejects anything that isn't a correctly signed, unexpired, `"type": "user_confirmation"` token. `cursor.rowcount == 0` after the `UPDATE` covers the case where the token is valid but the account it points to is already gone (deleted by `scripts/purge_unconfirmed_users.py`, see `scripts.md`, if the 24-hour window ran out before the link was clicked).

On success, this endpoint deliberately doesn't log the user in — it redirects into the app instead, via `Pages.Render("app_redirect", ...)` (see `pages.md`), which sends the browser to `_APP_DEEP_LINK` (a `panicswitch://` URL, see `credentials.md`). Confirming an email proves the person owns that inbox; it doesn't prove they're holding the phone that's about to open the link, so minting a session token here and handing it over inside a URL would be handing out a live credential over a channel (email) that's inherently less trustworthy than the login form itself. The person still has to log in with their password afterward — this endpoint's only job is flipping `confirmed` to `TRUE` and getting them back into the app to do that.

## `users.py`

```python
router = APIRouter(prefix="/users", tags=["users"])

_COLUMN_BY_FIELD: dict[str, str] = {
    "name":     "name",
    "phone":    "phone",
    "email":    "email",
    "password": "password_hash",
}
```

Groups operations on the authenticated user. Neither route takes an `id` as a URL parameter (there's no `/users/{id}`): both use `/me`, a deliberate pattern where "whose data is this" is never decided by the client typing a number into the URL, but by the token (`Depends(current_user)`, see `dependencies.md`). This makes it structurally impossible for a user to request or edit someone else's data just by changing a number — there's no number to change.

### `GET /users/me`

Fetches the authenticated user's row with `Queries.SELECT_USER_BY_ID` (see `cursor.md`), which deliberately doesn't include `password_hash` among the columns it selects — there's no risk of accidentally returning the hash because it's never even requested from the database.

### `PUT /users/me` — the dynamic `UPDATE` construction

Solves the **partial edits** problem: the client can send any subset of `name`, `phone`, `email`, `password` (see `types.md`, `UserUpdate`), and the generated `UPDATE` should only touch those columns, leaving the rest untouched.

1. `data.model_dump(exclude_none=True)` converts the Pydantic model into a `dict`, dropping any field left as `None` (that is, that the client didn't send). An empty result means there's nothing to update, and the endpoint responds `400 Bad Request`.
2. A changed `password` is replaced with its hash via `Guard.Hash` (see `guard.md`) **before** building the query — the plain text never becomes part of the SQL.
3. `_COLUMN_BY_FIELD` translates the Pydantic model's field name (`password`) to the table's actual column name (`password_hash`, see `sql.md`) — deliberately different, so the model speaks the same terms as the rest of the API without leaking the detail that, in the database, that value is a hash.
4. `set_clause` builds the `column = %s, column = %s, ...` portion of the query, only for the fields present. This is safe even though text is concatenated directly into the SQL string: what gets concatenated are *column names*, which can only come from `_COLUMN_BY_FIELD`'s fixed keys — never from an arbitrary value written by whoever calls the API. The actual *values* still travel parameterized as `%s`.
5. A `UNIQUE` violation on `phone`/`email` is caught as `DuplicateRecordError` (see `cursor.md`) and turned into `409`, same as registration.
6. After committing, the updated row is read back with `SELECT_USER_BY_ID` and returned in full, so the client doesn't have to guess the final state.

## `contacts.py`

```python
router = APIRouter(prefix="/contacts", tags=["contacts"])

_URL_BASE: str = get_credentials()['api_base_url']
```

The emergency-contacts CRUD, plus the confirmation endpoint. The three authenticated endpoints (`POST`, `GET ""`, `PUT`, `DELETE`) all share `Depends(current_user)`, which is enough to keep any of them from operating on someone else's contacts — `user_id` is never sent by the client, it always comes from the token. `GET /confirm/{token}` is the deliberate exception, same reasoning as `GET /auth/confirm/{token}` above.

`ContactUpdate`'s fields (`name`, `phone`, `email`, see `types.md`) are already named the same as their columns on `contacts` (see `sql.md`), so `PUT /{contact_id}`'s `set_clause` uses the field name directly — no `_COLUMN_BY_FIELD`-style translation needed here.

### `POST /contacts` and `GET /contacts`

No surprises in the `INSERT`/`SELECT`: they follow the same parameterized pattern as the rest of the project. Routes are declared as `""` (empty string), not `"/"` — with the router's `prefix="/contacts"`, `""` resolves to exactly `/contacts`, while `"/"` would produce `/contacts/`, a different URL as far as HTTP is concerned.

If the contact is created with an `email`, `POST /contacts` queues a confirmation email in the background (see `mail.md` for why it's a background task). `cursor.lastrowid` gives the just-inserted contact's `id`, needed to build the confirmation token with `Token.CreateContactConfirmation` (see `token.md`). A `SELECT_USER_BY_ID` also runs to get the name of whoever is adding the contact, used in the email's body — there's no way to avoid it without changing what `current_user` returns (see `dependencies.md`), which deliberately only exposes the `id`. If `data.email` is `None` (the only optional field on `Contact`, see `types.md`), nothing is sent, and that contact stays `confirmed = FALSE` indefinitely — there's no other channel today to confirm a contact without an email.

### `GET /contacts/confirm/{token}`

```python
@router.get("/confirm/{token}", response_class=HTMLResponse)
def confirm_contact(token: str):
    contact_id: int | None = Token.ValidateContactConfirmation(token)
    if contact_id is None:
        return HTMLResponse(Pages.Render("confirmation_result", {
            "success": False,
            "message": "This confirmation link is invalid or has expired. Ask to be added as an emergency contact again to get a new one.",
        }), status_code=401)

    cursor.execute(Queries.CONFIRM_CONTACT, (contact_id,))
    if cursor.rowcount == 0:
        return HTMLResponse(Pages.Render("confirmation_result", {
            "success": False,
            "message": "This contact no longer exists, so there's nothing left to confirm.",
        }), status_code=404)
    cursor.commit()

    return HTMLResponse(Pages.Render("confirmation_result", {
        "success": True,
        "message": "You'll now be notified by email if this person triggers a panic alert.",
    }))
```

Reached by clicking a link inside an email, not by navigating the app while logged in — whoever makes this request doesn't have, and can't have, a session JWT. Its authentication isn't "who are you," but "do you have the correct confirmation token, generated specifically for this contact?" — hence `Token.ValidateContactConfirmation` (see `token.md`) instead of `Depends(current_user)`.

`Token.ValidateContactConfirmation(token)` returns the `contact_id` if the token is valid and of the correct type, or `None` otherwise. With a valid `contact_id`, `Queries.CONFIRM_CONTACT` (see `cursor.md`) updates that row; `cursor.rowcount == 0` covers the token being valid but that contact no longer existing.

Unlike every JSON endpoint in the project, this responds with a rendered HTML page (`response_class=HTMLResponse` plus `Pages.Render`, see `pages.md`), because the caller is a person reading a browser tab, not an API client. All three outcomes (success, invalid/expired token, contact gone) render the same template with a different `success`/`message` pair, so the visitor always lands on a styled result page instead of raw `{"detail": "..."}`.

### `PUT /contacts/{contact_id}` — `rowcount` instead of a prior `SELECT`

Runs the `UPDATE` directly with `WHERE id = %s AND user_id = %s` and checks `cursor.rowcount` (see `cursor.md`) instead of first `SELECT`-ing to check "does this exist and is it mine?". If the `contact_id` doesn't exist, or exists but belongs to another user, the `WHERE` clause matches nothing and `rowcount` comes back `0` — both cases return the same `404`, without distinguishing them, for the same no-hints rationale as login: confirming that "contact 7 exists but isn't yours" reveals more than necessary. A single query also avoids a race condition (the contact being deleted or reassigned between a verification `SELECT` and a later `UPDATE`) that a two-step approach would leave open.

### `DELETE /contacts/{contact_id}`

```python
@router.delete("/{contact_id}", status_code=204)
def delete_contact(contact_id: int, user_id: int = Depends(current_user)):
    cursor.execute(Queries.DELETE_CONTACT, (contact_id, user_id))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    cursor.commit()
```

Same ownership-scoping pattern as `PUT`: `Queries.DELETE_CONTACT` (see `cursor.md`) filters by `id` *and* `user_id` in one statement, so a contact that belongs to someone else looks identical, from the response, to one that doesn't exist — `404` either way. `status_code=204` (No Content) is the conventional response for a successful delete with nothing meaningful to return; the function has no `return` statement, and FastAPI sends an empty body to match.

### `POST /contacts/{contact_id}/telegram/enable` and `DELETE /contacts/{contact_id}/telegram`

Same ownership-scoping pattern as `PUT`/`DELETE` above (`WHERE id = %s AND user_id = %s`, `rowcount == 0` → `404`). `POST .../enable` generates a single-use, DB-backed token (`secrets.token_urlsafe(24)`, not a JWT — see `telegram.md` for why) and either emails a `t.me` deep link to the contact, or — if the contact has no `email` on file — hands the link straight back in the response so the app can offer it to share manually. `DELETE .../telegram` just clears `telegram_chat_id`/token via `Queries.CLEAR_CONTACT_TELEGRAM`. Full flow (including how `telegram_chat_id` actually gets set) is in `telegram.md`, not repeated here.

## `alerts.py`

```python
router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.post("", status_code=201)
def create_alert(data: Alert, background_tasks: BackgroundTasks, user_id: int = Depends(current_user)):
    cursor.execute(Queries.INSERT_ALERT, (user_id, data.latitude, data.longitude))
    cursor.commit()

    user_rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    contacts: list[dict] = cursor.execute(Queries.SELECT_CONFIRMED_CONTACTS_BY_USER, (user_id,))

    context: dict = {
        "user_name":  user_rows[0]["name"],
        "user_phone": user_rows[0]["phone"],
        "user_email": user_rows[0]["email"],
        "timestamp":  datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "latitude":   data.latitude,
        "longitude":  data.longitude,
        "map_url":    f"https://www.google.com/maps?q={data.latitude},{data.longitude}",
    }

    mail_recipients: list[tuple[str, dict]] = [
        (contact["email"], {"contact_name": contact["name"], **context})
        for contact in contacts if contact["email"]
    ]
    telegram_recipients: list[tuple[int, dict]] = [
        (contact["telegram_chat_id"], {"contact_name": contact["name"], **context})
        for contact in contacts if contact["telegram_chat_id"]
    ]

    if mail_recipients:
        background_tasks.add_task(Mail.SendBulk, f"Panic alert from {user_rows[0]['name']}", "panic_alert", mail_recipients)

    if telegram_recipients:
        background_tasks.add_task(Telegram.SendBulk, "panic_alert", telegram_recipients)

    return {"Skellent": "Success!"}
```

The endpoint that corresponds to hitting the panic button itself — the project's ultimate purpose (see `sql.md`, `alerts` section). A single endpoint, with no `GET`/`PUT` of its own: today no one needs to list or edit past alerts, only create them.

### Why only **confirmed** contacts get notified

`Queries.SELECT_CONFIRMED_CONTACTS_BY_USER` (see `cursor.md`), not `SELECT_CONTACTS_BY_USER`, decides who to notify. This isn't a technical limitation but the whole reason the `confirmed`/`telegram_chat_id` columns exist on `contacts` (see `sql.md`): adding someone as an emergency contact doesn't automatically grant their consent to receive alerts on their behalf. A contact who never confirmed by either channel simply doesn't show up in this query and receives nothing.

### Why Telegram and email are dispatched as two separate background tasks

`create_alert` builds two recipient lists off the same `contacts` query result — one keyed by `email`, one by `telegram_chat_id` — and queues `Mail.SendBulk` and `Telegram.SendBulk` (see `telegram.md`) independently. A contact can be in either list, both, or neither; the two channels don't gate each other, so a Gmail outage doesn't stop Telegram notifications from going out, and vice versa.

### Why `Mail.SendBulk`, not `Mail.Send` in a loop

An alert may need to notify several confirmed contacts at once. `Mail.SendBulk` (see `mail.md`) opens a single SMTP connection and sends every email for that alert through it, and guarantees that one contact with a delivery problem doesn't stop the rest from being notified — see `mail.md` for the complete detail. `Telegram.SendBulk` follows the exact same shape, one `httpx.AsyncClient` reused across every chat id in the batch.

### Why in the background

The `INSERT` into `alerts` — the durable record that the alert happened — is committed **before** trying to notify anyone, and the `201` response arrives as soon as that finishes. Queuing `Mail.SendBulk` with `background_tasks.add_task` means whoever triggered the panic button doesn't wait for N emails to send to know their alert was logged — particularly important here, where confirming the alert fired as fast as possible matters more than anywhere else in the API.

### Why the email's `timestamp` doesn't come from a query against `alerts`

The template's context uses `datetime.now()`, computed at the moment of responding, not a `SELECT` of the just-inserted row (whose `created_at` MariaDB fills in with `DEFAULT CURRENT_TIMESTAMP`, see `sql.md`). In practice they're the same instant — an extra query isn't worth it just to show a value already known with more than enough precision for a notification email.

## `telegram.py`

```python
router = APIRouter(prefix="/telegram", tags=["telegram"])

@router.post("/webhook")
async def telegram_webhook(request: Request, x_telegram_bot_api_secret_token: str | None = Header(default=None)):
    if _WEBHOOK_SECRET and x_telegram_bot_api_secret_token != _WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")
    try:
        await _handle_update(await request.json())
    except Exception as e:
        print(f"Error handling Telegram webhook: {e}")
    return {"ok": True}
```

The one endpoint in this file that isn't reached by the app at all — Telegram's own servers call it, every time someone messages the bot. It has no `Depends(current_user)`: there's no session token to check, because the caller isn't a logged-in user, it's Telegram relaying an `Update`. See `telegram.md` for the full flow, the webhook secret, and why it always answers `200` even when something inside failed.

## `features.py`

```python
router = APIRouter(prefix="/features", tags=["features"])

@router.get("")
def get_features():
    return {
        "telegram": bool(_credentials['telegram']['bot_token']) and bool(_credentials['telegram']['bot_username']),
    }
```

Tells the app which optional integrations are actually usable in this deployment — just `telegram` for now. No `Depends(current_user)` either, but for the opposite reason from the webhook above: this isn't unauthenticated because there's no user to check, it's unauthenticated because the answer doesn't depend on which user is asking — every caller gets the same deployment-wide answer, and there's no reason to make the app wait for a session before it can decide what to render. See `features.md` for why this exists (a contact could otherwise be sent a broken `t.me` link) and why it checks both `bot_token` and `bot_username`.

## Relationship with the rest of the backend

`main.py` imports all six modules in this directory and mounts their routers with `include_router` (see `main.md`). All of them depend on `modules/db.py` (the shared `cursor`) and `modules/cursor.py` (`Queries`, and — except `alerts.py` and `features.py` — `DuplicateRecordError`); `users.py`, `contacts.py` and `alerts.py` additionally depend on `modules/dependencies.py` to require authentication. `modules/guard.py` is used by `auth.py` (hashing at registration, verifying at login) and `users.py` (hashing on password change). `modules/token.py` is used by `auth.py` (session and user-confirmation tokens) and `contacts.py` (contact-confirmation tokens) — `alerts.py`, `users.py` and `features.py` don't issue or validate any token of their own. `modules/mail.py` (see `mail.md`) is used by `auth.py` and `contacts.py` (`Mail.Send`, one recipient at a time) and `alerts.py` (`Mail.SendBulk`, one to many). `modules/pages.py` (see `pages.md`) is used by `auth.py` and `contacts.py`, to render the HTML pages their `confirm/{token}` endpoints show instead of JSON. `modules/telegram.py` (see `telegram.md`) is used by `contacts.py` (linking/unlinking), `alerts.py` (`Telegram.SendBulk`), and its own `telegram.py` router (`Telegram.Send` for the bot's chat replies) — `telegram.py` (the router) is also the only file in this directory `contacts.py` doesn't import from, and vice versa; the two share the database, not each other's code. `features.py` is the odd one out: it's the only router that only depends on `modules/credentials.py`, not the database at all.
