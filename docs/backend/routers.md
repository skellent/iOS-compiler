# `modules/routers/` — API endpoints

This directory holds all of the API's business logic, split across seven files by the resource they belong to. Unlike the other backend modules, which each have their own `.md`, these are documented together in a single file — the same approach `sql.md` uses to group the three `queries/` scripts, because these are pieces that only make sense read together (they share the same dependencies and the same patterns).

Each file defines an `APIRouter` with a fixed prefix and exposes it as `router`, which `main.py` mounts with `app.include_router(...)` (see `main.md`):

| File            | Prefix       | Endpoints |
|------------------|---------------|-----------|
| `auth.py`        | `/auth`       | `POST /register`, `POST /login`, `GET /confirm/{token}` |
| `users.py`       | `/users`      | `GET /me`, `PUT /me` |
| `contacts.py`    | `/contacts`   | `POST /`, `GET /`, `GET /confirm/{token}`, `PUT /{contact_id}`, `DELETE /{contact_id}`, `POST /{contact_id}/telegram/enable`, `DELETE /{contact_id}/telegram` |
| `alerts.py`      | `/alerts`     | `POST /`, `GET /`, `GET /view/{token}` |
| `telegram.py`    | `/telegram`   | `POST /webhook` |
| `features.py`    | `/features`   | `GET /` |
| `dashboard.py`   | `/dashboard`  | `GET /` |

## Why `APIRouter` instead of putting it all in `main.py`

`APIRouter` is the FastAPI piece designed exactly for this: it allows declaring endpoints in a file separate from where the main `FastAPI()` instance lives, with its own route prefix and its own tags (used to visually group endpoints in the `/docs` automatic documentation), and then "attaching" them to the real application with `include_router`. It's what lets `main.py` stay barely ten lines (see `main.md`) even as the API grew to a dozen endpoints across four resources.

## `auth.py`

```python
router = APIRouter(prefix="/auth", tags=["auth"])

_URL_BASE: str = get_credentials()['api_base_url']
_logger = get_logger(__name__)
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

    return HTMLResponse(
        Pages.Render("confirmation_result", {
            "success": True,
            "message": "Your account is confirmed. Open the Panic Switch app and log in to get started.",
        })
    )
```

The other end of `POST /register`'s email. Whoever hits this endpoint is a person who just clicked a link in their inbox, not an API client, so it responds with rendered HTML (`modules/pages.py`, see `pages.md`) instead of JSON — same reasoning as `GET /contacts/confirm/{token}` below. `Token.ValidateUserConfirmation` (see `token.md`) rejects anything that isn't a correctly signed, unexpired, `"type": "user_confirmation"` token. `cursor.rowcount == 0` after the `UPDATE` covers the case where the token is valid but the account it points to is already gone (deleted by `scripts/purge_unconfirmed_users.py`, see `scripts.md`, if the 24-hour window ran out before the link was clicked).

On success, this endpoint deliberately doesn't log the user in — it renders the same `confirmation_result` template `GET /contacts/confirm/{token}` uses (see `pages.md`), telling the person to go open the app and log in themselves, instead of trying to get them back into a live session automatically. This used to attempt exactly that, via a dedicated `app_redirect.html.j2` template that pointed the browser at a `panicswitch://` deep link (`APP_DEEP_LINK`, see this document's git history and `credentials.md` for the removed setting) — dropped because the app never actually registered a handler for that custom URL scheme at the native (Android/iOS) level, so the redirect had nothing to open on any real device and the button always fell through to its manual fallback anyway. Confirming an email proves the person owns that inbox; it doesn't prove they're holding the phone that's about to open the link, so minting a session token here and handing it over inside a URL would have meant handing out a live credential over a channel (email) that's inherently less trustworthy than the login form itself, even if the deep link had worked. The person still has to log in with their password afterward — this endpoint's only job is flipping `confirmed` to `TRUE` and telling them to go do that.

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

_URL_BASE: str = get_credentials()['api_base_url']
_logger = get_logger(__name__)


def _create_notification(alert_id: int, contact_id: int, channel: str) -> int:
    cursor.execute(Queries.INSERT_ALERT_NOTIFICATION, (alert_id, contact_id, channel))
    cursor.commit()
    return cursor.lastrowid


def _view_url(notification_id: int) -> str:
    token: str = Token.CreateAlertNotificationView(notification_id)
    return f"{_URL_BASE}/alerts/view/{token}"


@router.post("", status_code=201)
def create_alert(data: Alert, background_tasks: BackgroundTasks, user_id: int = Depends(current_user)):
    cursor.execute(Queries.INSERT_ALERT, (user_id, data.latitude, data.longitude))
    cursor.commit()
    alert_id: int = cursor.lastrowid
    _logger.warning(f"Panic alert {alert_id} triggered by user {user_id} at {data.latitude},{data.longitude}")

    user_rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    contacts: list[dict] = cursor.execute(Queries.SELECT_CONFIRMED_CONTACTS_BY_USER, (user_id,))

    base_context: dict = {
        "user_name":  user_rows[0]["name"],
        "user_phone": user_rows[0]["phone"],
        "user_email": user_rows[0]["email"],
        "timestamp":  datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "latitude":   data.latitude,
        "longitude":  data.longitude,
    }

    mail_recipients: list[tuple[str, dict]] = []
    telegram_recipients: list[tuple[int, dict]] = []

    for contact in contacts:
        if contact["email"]:
            notification_id: int = _create_notification(alert_id, contact["id"], "email")
            mail_recipients.append((contact["email"], {
                "contact_name": contact["name"],
                "map_url": _view_url(notification_id),
                **base_context,
            }))
        if contact["telegram_chat_id"]:
            notification_id: int = _create_notification(alert_id, contact["id"], "telegram")
            telegram_recipients.append((contact["telegram_chat_id"], {
                "contact_name": contact["name"],
                "map_url": _view_url(notification_id),
                **base_context,
            }))

    if mail_recipients:
        background_tasks.add_task(Mail.SendBulk, f"Panic alert from {user_rows[0]['name']}", "panic_alert", mail_recipients)

    if telegram_recipients:
        background_tasks.add_task(Telegram.SendBulk, "panic_alert", telegram_recipients)

    _logger.info(
        f"Alert {alert_id}: notifying {len(mail_recipients)} contact(s) by email, "
        f"{len(telegram_recipients)} by Telegram"
    )

    return {"Skellent": "Success!"}
```

The endpoint that corresponds to hitting the panic button itself — the project's ultimate purpose (see `sql.md`, `alerts` section). It used to be the only endpoint in this file; `GET /alerts` and `GET /alerts/view/{token}` (both below) were added alongside the dashboard (see `dashboard.py`, further down) to let a user see their own alert history and know whether it actually reached anyone.

### Why only **confirmed** contacts get notified

`Queries.SELECT_CONFIRMED_CONTACTS_BY_USER` (see `cursor.md`), not `SELECT_CONTACTS_BY_USER`, decides who to notify. This isn't a technical limitation but the whole reason the `confirmed`/`telegram_chat_id` columns exist on `contacts` (see `sql.md`): adding someone as an emergency contact doesn't automatically grant their consent to receive alerts on their behalf. A contact who never confirmed by either channel simply doesn't show up in this query and receives nothing.

### Why a notification row is created *before* attempting to send

`_create_notification` runs, and commits, once per contact per channel — inside the same `for` loop that builds `mail_recipients`/`telegram_recipients`, before either `Mail.SendBulk` or `Telegram.SendBulk` is even queued. This ordering is deliberate: the row (and the `id` it produces, needed to build that recipient's `map_url` via `_view_url`) has to exist *before* the message that references it goes out, not after — building the link first and inserting the row afterward would risk a message linking to a row that doesn't exist yet if the two ever raced. The consequence worth knowing is that a notification row gets created even if the send that follows later fails; there's no rollback tying the two together, since the row's purpose (a durable "this contact was owed a notification through this channel" record with a `viewed_at` to fill in later) is arguably still correct even when the send itself didn't succeed — see `mail.md`'s note on `MailNotSentError` now being logged for that failure case.

### Why Telegram and email are dispatched as two separate background tasks

`create_alert` builds two recipient lists off the same `contacts` query result — one keyed by `email`, one by `telegram_chat_id` — and queues `Mail.SendBulk` and `Telegram.SendBulk` (see `telegram.md`) independently. A contact can be in either list, both, or neither; the two channels don't gate each other, so a Gmail outage doesn't stop Telegram notifications from going out, and vice versa. A contact confirmed on both channels gets two notification rows for this same alert (see `sql.md`) — one per channel, each with its own tracking link and its own independent `viewed_at`.

### Why `Mail.SendBulk`, not `Mail.Send` in a loop

An alert may need to notify several confirmed contacts at once. `Mail.SendBulk` (see `mail.md`) opens a single SMTP connection and sends every email for that alert through it, and guarantees that one contact with a delivery problem doesn't stop the rest from being notified — see `mail.md` for the complete detail. `Telegram.SendBulk` follows the exact same shape, one `httpx.AsyncClient` reused across every chat id in the batch.

### Why in the background

The `INSERT` into `alerts` — the durable record that the alert happened — is committed **before** trying to notify anyone, and the `201` response arrives as soon as that finishes. Queuing `Mail.SendBulk` with `background_tasks.add_task` means whoever triggered the panic button doesn't wait for N emails to send to know their alert was logged — particularly important here, where confirming the alert fired as fast as possible matters more than anywhere else in the API.

### Why the email's `timestamp` doesn't come from a query against `alerts`

The template's context uses `datetime.now()`, computed at the moment of responding, not a `SELECT` of the just-inserted row (whose `created_at` MariaDB fills in with `DEFAULT CURRENT_TIMESTAMP`, see `sql.md`). In practice they're the same instant — an extra query isn't worth it just to show a value already known with more than enough precision for a notification email.

### `GET /alerts` — the authenticated user's own alert history

```python
@router.get("")
def list_alerts(user_id: int = Depends(current_user)):
    alerts: list[dict] = cursor.execute(Queries.SELECT_ALERTS_BY_USER, (user_id,))
    for alert in alerts:
        alert["notifications"] = cursor.execute(Queries.SELECT_ALERT_NOTIFICATIONS_BY_ALERT, (alert["id"],))
    return alerts
```

The dashboard's data source (see `dashboard.py`, below). `Queries.SELECT_ALERTS_BY_USER` (see `cursor.md`) already scopes by `user_id` — same `Depends(current_user)` ownership pattern used everywhere else in this file — so there's no way to request another user's alert history by guessing an id, the same way there's no `/alerts/{id}` at all. For each alert, a second query (`SELECT_ALERT_NOTIFICATIONS_BY_ALERT`) fetches who was notified and whether they've seen it; this is N+1 queries (one for the alerts, one more per alert) rather than a single `JOIN`, an acceptable tradeoff at this project's scale — a user's alert history is expected to be a handful of rows, not thousands — in exchange for a much simpler shape to build in Python (a list of alerts, each carrying its own `notifications` list) than collapsing a joined result set back into that same nested shape would be.

### `GET /alerts/view/{token}` — the read-receipt link

```python
@router.get("/view/{token}")
def view_alert_notification(token: str):
    notification_id: int | None = Token.ValidateAlertNotificationView(token)
    if notification_id is None:
        _logger.warning("Alert view link used with an invalid token")
        return HTMLResponse(
            Pages.Render("confirmation_result", {"success": False, "message": "This link is invalid."}),
            status_code=401,
        )

    rows: list[dict] = cursor.execute(Queries.SELECT_ALERT_NOTIFICATION_BY_ID, (notification_id,))
    if not rows:
        _logger.warning(f"Alert view link used for notification {notification_id}, which no longer exists")
        return HTMLResponse(
            Pages.Render("confirmation_result", {"success": False, "message": "This alert no longer exists."}),
            status_code=404,
        )

    notification: dict = rows[0]
    if notification["viewed_at"] is None:
        cursor.execute(Queries.MARK_ALERT_NOTIFICATION_VIEWED, (notification_id,))
        cursor.commit()
        _logger.info(f"Alert notification {notification_id} viewed for the first time")

    map_url: str = f"https://www.google.com/maps?q={notification['latitude']},{notification['longitude']}"
    return RedirectResponse(url=map_url, status_code=302)
```

This is the URL every `map_url` in a panic-alert email or Telegram message actually points to (see `mail.md`, `telegram.md`) — not Google Maps directly. Like the two `confirm/{token}` endpoints elsewhere in this file, the caller is a person tapping a link from an email client or a chat app, not an API client, and there's no session to check — `Token.ValidateAlertNotificationView` (see `token.md`) is what proves the request is legitimate, the same "does this token check out" authentication (rather than "who are you") every other `{token}` route in this codebase uses.

Three response shapes:

- **Invalid/expired token** → `401` with the shared `confirmation_result` template (see `pages.md`). "Expired" doesn't actually apply here in practice — this is the one token in the project with no `exp` claim at all (see `token.md`) — but a tampered or malformed token still fails signature verification the same way.
- **Token valid, but the row is gone** → `404`, same template. Nothing in the API deletes `alert_notifications` rows today, so this is mostly defensive, the same posture `GET /auth/confirm/{token}`/`GET /contacts/confirm/{token}` already take toward their own already-gone-by-the-time-you-click-it case.
- **Success** → `302` straight to `https://www.google.com/maps?q=...`, built from the alert's `latitude`/`longitude` fetched alongside the notification row (`SELECT_ALERT_NOTIFICATION_BY_ID` joins to `alerts` for exactly this, see `cursor.md`). This is a real redirect, not an HTML page — a contact who taps this link wants the map, not a confirmation screen, so unlike every other `{token}` route in this file, the "success" case here isn't `Pages.Render` at all.

`Queries.MARK_ALERT_NOTIFICATION_VIEWED`'s own `WHERE ... AND viewed_at IS NULL` (see `cursor.md`) already makes a repeat visit a no-op at the SQL level, but the `if notification["viewed_at"] is None:` check here avoids running that (harmless but pointless) `UPDATE`/`commit`/log line at all on a link that's already been opened before — the redirect to the map happens either way, whether this was the first click or the fifth.

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
        _logger.exception(f"Error handling Telegram webhook: {e}")
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

## `dashboard.py`

```python
router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("", response_class=HTMLResponse)
def dashboard():
    return HTMLResponse(Pages.Render("dashboard", {}))
```

The smallest router in the project on purpose: one route, rendering `templates/web/dashboard.html.j2` (see `pages.md`) with an *empty* context — unlike every other `Pages.Render` call in the codebase, which passes `success`/`message` or similar server-computed values. The page itself is a small single-page app: a login form that `POST`s to `/auth/login` from client-side JavaScript, and — once it has a token — calls `GET /alerts` (above) and renders the result. `dashboard()` never touches the database or `current_user`; it has no idea who's asking or whether they're logged in, because the login/data-fetching happens entirely in the browser, after the page has already loaded. This is a deliberate departure from every other server-rendered page in `templates/web/` (`confirmation_result.html.j2`, see `pages.md`), which are always the *final* step of some server-side flow (a token got validated, a flag got flipped) — `dashboard.html.j2` is the *starting* point of a flow that runs entirely in JavaScript from there, reusing the same JSON endpoints (`POST /auth/login`, `GET /alerts`) the mobile app itself calls, rather than introducing a parallel, dashboard-only API.

`GET /` on `main.py` (see `main.md`) redirects here (`302` to `/dashboard`) — visiting the API's root now lands a person on something useful instead of a bare JSON health-check string.

## Relationship with the rest of the backend

`main.py` imports all seven modules in this directory and mounts their routers with `include_router` (see `main.md`). All of them depend on `modules/db.py` (the shared `cursor`) and `modules/cursor.py` (`Queries`, and — except `alerts.py`, `features.py` and `dashboard.py` — `DuplicateRecordError`); `users.py`, `contacts.py` and `alerts.py` additionally depend on `modules/dependencies.py` to require authentication. `modules/guard.py` is used by `auth.py` (hashing at registration, verifying at login) and `users.py` (hashing on password change). `modules/token.py` is used by `auth.py` (session and user-confirmation tokens), `contacts.py` (contact-confirmation tokens), and `alerts.py` (alert-notification view tokens) — `users.py` and `features.py` don't issue or validate any token of their own. `modules/mail.py` (see `mail.md`) is used by `auth.py` and `contacts.py` (`Mail.Send`, one recipient at a time) and `alerts.py` (`Mail.SendBulk`, one to many). `modules/pages.py` (see `pages.md`) is used by `auth.py`, `contacts.py` and `alerts.py`, to render the HTML pages their `confirm/{token}`/`view/{token}` endpoints show instead of JSON, and by `dashboard.py` for its one static-context page. `modules/telegram.py` (see `telegram.md`) is used by `contacts.py` (linking/unlinking), `alerts.py` (`Telegram.SendBulk`), and its own `telegram.py` router (`Telegram.Send` for the bot's chat replies). `modules/logs.py` (see `logs.md`) is used by every file in this directory except `dashboard.py`, which has nothing of its own worth logging. `features.py` and `dashboard.py` are the odd ones out: neither depends on the database at all — `features.py` only reads `modules/credentials.py`, and `dashboard.py` only renders a static template.
