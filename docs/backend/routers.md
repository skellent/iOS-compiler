# `modules/routers/` — API endpoints

This directory holds all of the API's business logic, split across four files by the resource they belong to. Unlike the other backend modules, which each have their own `.md`, these are documented together in a single file — the same approach already used in `sql.md` to group the three `queries/` scripts, because these are pieces that only make sense read together (they share the same dependencies and the same pattern).

Each file defines an `APIRouter` with a fixed prefix and exposes it as `router`, which `main.py` mounts with `app.include_router(...)` (see `main.md`):

| File            | Prefix       | Endpoints |
|------------------|---------------|-----------|
| `auth.py`        | `/auth`       | `POST /register`, `POST /login` |
| `users.py`       | `/users`      | `GET /me`, `PUT /me` |
| `contacts.py`    | `/contacts`   | `POST /`, `GET /`, `GET /confirm/{token}`, `PUT /{contact_id}` |
| `alerts.py`      | `/alerts`     | `POST /` |

## Why `APIRouter` instead of putting it all in `main.py`

`APIRouter` is the FastAPI piece designed exactly for this problem: it allows declaring endpoints in a file separate from where the main `FastAPI()` instance lives, with its own route prefix and its own tags (used to visually group endpoints in the `/docs` automatic documentation), and then "attaching" them to the real application with `include_router`. It's what let `main.py` shrink down to barely ten lines (see `main.md`) even as the API grew from one endpoint to nine.

## `auth.py`

```python
from fastapi import APIRouter, HTTPException

from modules.cursor  import Queries, DuplicateRecordError
from modules.db      import cursor
from modules.guard   import Guard
from modules.token   import Token
from modules.types   import User, UserLogin

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
def register(data: User):
    password_hash: str = Guard.Hash(data.password)
    try:
        cursor.execute(Queries.INSERT_USER, (
            data.name,
            data.phone,
            data.email,
            password_hash)
        )
    except DuplicateRecordError:
        raise HTTPException(status_code=409, detail="Phone or email already registered")
    cursor.commit()

    return {"Skellent": "Success!"}


@router.post("/login")
def login(data: UserLogin):
    rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_EMAIL, (data.email,))
    if not rows or not Guard.Verify(data.password, rows[0]["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token: str = Token.Create(rows[0]["id"])
    return {"access_token": token, "token_type": "bearer"}
```

Groups the only two routes that **don't** require authentication — that makes sense, since their whole purpose is, precisely, to obtain the credentials (`/register`) or the token (`/login`) everything else will require.

### `POST /auth/register`

This is the project's original endpoint (it used to live in `main.py` as `POST /registrar/usuario`), moved here without changing its underlying logic, plus one important fix: the `try/except DuplicateRecordError` block. Before, registering an already-existing `phone` or `email` (both are `UNIQUE` on the `users` table, see `sql.md`) made MariaDB reject the `INSERT` with an error that wasn't caught anywhere, and that error ended up bubbling all the way to FastAPI as a `500 Internal Server Error` — the worst possible response for what is actually a client error (it sent data that collides with an existing one), not a server error. `DuplicateRecordError` (see `cursor.md`) is the translation of that specific MariaDB error into something this file can understand without importing `mariadb`, and it turns into a `409 Conflict` — the HTTP code meant exactly for "this request couldn't be completed because it conflicts with the resource's current state."

The rest of the flow is the same as what `main.md` used to document before this change: `Guard.Hash` (see `guard.md`) hashes the password before the plain text ever touches the database, and `status_code=201` is declared explicitly because the operation creates a new resource.

### `POST /auth/login`

This is the entirely new endpoint in this file. The flow:

1. `Queries.SELECT_USER_BY_EMAIL` (see `cursor.md`) looks up the user by their email, also fetching `password_hash` — the only query in the project that exposes that field, because it's the only one that needs it.
2. `if not rows or not Guard.Verify(...)`: a single condition checks both "the email doesn't exist" (`rows` empty) and "the password doesn't match" (`Guard.Verify` returns `False`, see `guard.md`). Both cases respond with exactly the same `401 Unauthorized` and the same generic message ("Incorrect email or password"), on purpose: if the message differed depending on which of the two failed, anyone could use the endpoint to find out which emails are registered in the system by trying them one by one (a user-enumeration attack). Note the use of `not rows or not Guard.Verify(...)`: thanks to Python's `or` short-circuiting, if `rows` is empty, `Guard.Verify` never even gets called — avoiding an `IndexError` from trying to access `rows[0]` when there's no row.
3. If everything matches, `Token.Create(rows[0]["id"])` (see `token.md`) signs a JWT with that user's `id`, and it's returned along with `token_type: "bearer"` — the standard name for the scheme the client must prepend when sending the token back (`Authorization: Bearer <token>`, see `dependencies.md`).

This endpoint doesn't require `Depends(current_user)`, for obvious reasons: it's the entry point that produces the token, it can't require one to work.

## `users.py`

```python
from fastapi import APIRouter, Depends, HTTPException

from modules.cursor       import Queries, DuplicateRecordError
from modules.db           import cursor
from modules.dependencies import current_user
from modules.guard        import Guard
from modules.types        import UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

_COLUMN_BY_FIELD: dict[str, str] = {
    "name":     "name",
    "phone":    "phone",
    "email":    "email",
    "password": "password_hash",
}


@router.get("/me")
def get_current_user(user_id: int = Depends(current_user)):
    rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")
    return rows[0]


@router.put("/me")
def update_current_user(data: UserUpdate, user_id: int = Depends(current_user)):
    fields: dict = data.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields were provided to update")

    if "password" in fields:
        fields["password"] = Guard.Hash(fields["password"])

    set_clause: str = ", ".join(f"{_COLUMN_BY_FIELD[field]} = %s" for field in fields)
    values: tuple = tuple(fields.values()) + (user_id,)

    try:
        cursor.execute(f"UPDATE users SET {set_clause} WHERE id = %s;", values)
    except DuplicateRecordError:
        raise HTTPException(status_code=409, detail="Phone or email already registered")
    cursor.commit()

    rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    return rows[0]
```

Groups operations on the authenticated user. Note that neither route takes an `id` as a URL parameter (there's no `/users/{id}`): both use `/me`, a deliberate pattern where "whose data is this" is never decided by the client typing a number into the URL, but by the token (`Depends(current_user)`, see `dependencies.md`). This makes it structurally impossible for a user to request or edit someone else's data just by changing a number — there's no number to change.

### `GET /users/me`

The simpler of the two: fetches the authenticated user's row with `Queries.SELECT_USER_BY_ID` (see `cursor.md`), which deliberately doesn't include `password_hash` among the columns it selects — there's no risk of accidentally returning the hash because it's never even requested from the database.

### `PUT /users/me` and the dynamic `UPDATE` construction

This is the most elaborate of the seven endpoints, because it solves the **partial edits** problem: the client can send any subset of `name`, `phone`, `email`, `password` (see `types.md`, `UserUpdate`), and the generated `UPDATE` should only touch those columns, leaving the rest untouched. Step by step:

1. `data.model_dump(exclude_none=True)` converts the Pydantic model into a `dict`, dropping any field left as `None` (that is, that the client didn't send). If the result is an empty dictionary, there's nothing to update and it responds `400 Bad Request` — it wouldn't make sense to run an `UPDATE ... SET` with no columns.
2. If the client decided to change their `password`, it's replaced with its hash via `Guard.Hash` (see `guard.md`) **before** building the query, exactly like at registration: the plain text never becomes part of the SQL.
3. `_COLUMN_BY_FIELD` translates the Pydantic model's field name (`password`) to the table's actual column name (`password_hash`, see `sql.md`) — they're deliberately different, so the model speaks the same terms as the rest of the API (`password`) without leaking the detail that, in the database, that value is a hash.
4. `set_clause` builds the `column = %s, column = %s, ...` portion of the query, only for the fields present in `fields`. **This is safe** even though text is being concatenated directly into the SQL string: what gets concatenated are *column names*, which can only come from `_COLUMN_BY_FIELD`'s fixed keys (in turn derived from the fields declared on `UserUpdate`, see `types.md`) — never from an arbitrary value written by whoever calls the API. The actual *values*, which do come from the client and could be malicious, still travel parameterized as `%s` inside `values`, same as in every other query in this project.
5. If the `UPDATE` violates the `UNIQUE` constraint on `phone` or `email` (for example, the user tries to change their email to one already used by another account), `Cursor.execute` translates it to `DuplicateRecordError` (see `cursor.md`) and the endpoint responds `409`, on the same rationale as registration.
6. After the `commit`, the updated row is read back with `SELECT_USER_BY_ID` and returned in full, so the client doesn't have to guess the final state by combining what it sent with what it already had.

## `contacts.py`

```python
from fastapi           import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import HTMLResponse

from modules.mail         import Mail
from modules.credentials  import get_credentials
from modules.cursor       import Queries
from modules.db           import cursor
from modules.dependencies import current_user
from modules.pages        import Pages
from modules.token        import Token
from modules.types        import Contact, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])

_URL_BASE: str = get_credentials()['api_base_url']


@router.post("", status_code=201)
def create_contact(data: Contact, background_tasks: BackgroundTasks, user_id: int = Depends(current_user)):
    cursor.execute(Queries.INSERT_CONTACT, (user_id, data.name, data.phone, data.email))
    cursor.commit()
    contact_id: int = cursor.lastrowid

    if data.email:
        rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
        token: str = Token.CreateContactConfirmation(contact_id)
        background_tasks.add_task(
            Mail.Send,
            data.email,
            "Confirm that you are an emergency contact",
            "contact_confirmation",
            {
                "contact_name":     data.name,
                "user_name":        rows[0]["name"],
                "confirmation_url": f"{_URL_BASE}/contacts/confirm/{token}",
            },
        )

    return {"Skellent": "Success!"}


@router.get("")
def list_contacts(user_id: int = Depends(current_user)):
    return cursor.execute(Queries.SELECT_CONTACTS_BY_USER, (user_id,))


@router.get("/confirm/{token}", response_class=HTMLResponse)
def confirm_contact(token: str):
    contact_id: int | None = Token.ValidateContactConfirmation(token)
    if contact_id is None:
        return HTMLResponse(
            Pages.Render("confirmation_result", {
                "success": False,
                "message": "This confirmation link is invalid or has expired. Ask to be added as an emergency contact again to get a new one.",
            }),
            status_code=401,
        )

    cursor.execute(Queries.CONFIRM_CONTACT, (contact_id,))
    if cursor.rowcount == 0:
        return HTMLResponse(
            Pages.Render("confirmation_result", {
                "success": False,
                "message": "This contact no longer exists, so there's nothing left to confirm.",
            }),
            status_code=404,
        )
    cursor.commit()

    return HTMLResponse(
        Pages.Render("confirmation_result", {
            "success": True,
            "message": "You'll now be notified by email if this person triggers a panic alert.",
        })
    )


@router.put("/{contact_id}")
def update_contact(contact_id: int, data: ContactUpdate, user_id: int = Depends(current_user)):
    fields: dict = data.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields were provided to update")

    set_clause: str = ", ".join(f"{field} = %s" for field in fields)
    values: tuple = tuple(fields.values()) + (contact_id, user_id)

    cursor.execute(f"UPDATE contacts SET {set_clause} WHERE id = %s AND user_id = %s;", values)
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    cursor.commit()

    rows: list[dict] = cursor.execute(
        "SELECT id, name, phone, email, confirmed FROM contacts WHERE id = %s;",
        (contact_id,)
    )
    return rows[0]
```

This is the emergency-contacts CRUD, plus the confirmation endpoint added alongside `modules/mail.py` (see `mail.md` for the complete flow). The three protected endpoints (`POST`, `GET ""`, `PUT`) share `Depends(current_user)`, and that's enough to keep any of them from operating on someone else's contacts — `user_id` is never sent by the client, it always comes from the token. `GET /confirm/{token}` is the deliberate exception, see its own section below.

Unlike `users.py`, `_COLUMN_BY_FIELD` wasn't needed here: `ContactUpdate`'s three fields (`name`, `phone`, `email`, see `types.md`) are already named the same as their columns on the `contacts` table (see `sql.md`), so `set_clause` uses the field name directly.

### `POST /contacts` and `GET /contacts`

No surprises in the `INSERT`/`SELECT`: they follow the same parameterized pattern as the rest of the project. Note the routes are declared as `""` (empty string), not `"/"` — with the router's `prefix="/contacts"`, `""` resolves to exactly `/contacts`, while `"/"` would have produced `/contacts/` with a trailing slash, a different URL as far as HTTP is concerned, which would have forced clients to get the slash right or deal with a redirect.

What is new in `POST /contacts`: if the contact was created with an `email`, sending a confirmation email in the background is triggered (`background_tasks.add_task(Mail.Send, ...)`, see `mail.md` for why it's in the background instead of a direct `await`). `cursor.lastrowid` (see `cursor.md`) gives the `id` of the just-inserted contact, needed to generate the confirmation token with `Token.CreateContactConfirmation` (see `token.md`) before the link can be built. An extra `SELECT_USER_BY_ID` is also run to get the `name` of whoever is adding the contact — it's used in the email's body ("So-and-so added you as an emergency contact"), and there was no way to avoid it without changing `current_user`'s signature (see `dependencies.md`), which deliberately only returns the `id`, not the full row. If `data.email` is `None` (remember it's `Contact`'s only optional field, see `types.md`), nothing is sent — there's no way to confirm a contact by email without an email, and that contact simply stays at `confirmed = FALSE` indefinitely until the project adds another confirmation channel (SMS, for example, once the pending Twilio integration lands).

### `GET /contacts/confirm/{token}`

Along with `auth.py`'s two routes, this is one of the few backend endpoints that does **not** require `Depends(current_user)` — for the same reason as those: this endpoint is reached by clicking a link inside an email, not by navigating the app while already logged in, so whoever makes the request doesn't have (and can't have) a session JWT. This endpoint's authentication isn't "who are you," but "do you have the correct confirmation token, generated specifically for this contact?" — hence it uses `Token.ValidateContactConfirmation` (see `token.md`) instead of the standard dependency.

The flow is deliberately just as simple as the rest of the CRUD: `Token.ValidateContactConfirmation(token)` returns the `contact_id` if the token is valid and of the correct type, or `None` if not (corrupt token, expired, or of another type — a session JWT, for example). With the `contact_id` in hand, `Queries.CONFIRM_CONTACT` (see `cursor.md`) updates that row, and `cursor.rowcount == 0` covers the case "the token was valid but that `contact_id` no longer exists" (for example, if the contact was deleted — though there's no `DELETE /contacts/{id}` today, the check is kept in case one is added later, the same defensive rationale `PUT /{contact_id}` already uses).

Unlike every other endpoint in the project, this one doesn't respond with JSON: `response_class=HTMLResponse` plus `Pages.Render` (see `pages.md`) return a full HTML page instead, because the caller here is a person reading a browser tab after clicking a link in an email, not an API client. `HTTPException` (which the rest of the project uses for error responses) isn't used in this endpoint precisely for that reason — it would still produce a JSON body, which is exactly what this change moves away from. Both the success and the two failure cases (invalid/expired token, contact no longer exists) render the same template with a different `success`/`message` context, so the visitor always lands on a styled result page instead of raw `{"detail": "..."}`.

### `PUT /contacts/{contact_id}` and why it uses `rowcount` instead of a prior `SELECT`

This is the only endpoint in the project that needs to respond `404 Not Found`, and it does so in a particular way: instead of first running a `SELECT` to check "does this contact exist and is it mine?" and then the `UPDATE`, it runs the `UPDATE` directly with `WHERE id = %s AND user_id = %s` and checks how many rows it affected with `cursor.rowcount` (see `cursor.md`). If the `contact_id` doesn't exist, or exists but belongs to another user, the `WHERE` clause finds no row to update and `rowcount` comes back `0` — and both cases (doesn't exist / isn't yours) return the same `404`, without distinguishing them in the message, for the same no-hints rationale already explained for login: confirming to someone that "contact 7 exists but isn't yours" reveals more than necessary. Doing it in a single query also avoids a race condition (the contact being deleted or reassigned between the verification `SELECT` and the later `UPDATE`) that could happen with the two-step approach.

## `alerts.py`

```python
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends

from modules.mail         import Mail
from modules.cursor       import Queries
from modules.db           import cursor
from modules.dependencies import current_user
from modules.types        import Alert

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", status_code=201)
def create_alert(data: Alert, background_tasks: BackgroundTasks, user_id: int = Depends(current_user)):
    cursor.execute(Queries.INSERT_ALERT, (user_id, data.latitude, data.longitude))
    cursor.commit()

    user_rows: list[dict] = cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,))
    contacts: list[dict] = cursor.execute(Queries.SELECT_CONFIRMED_CONTACTS_BY_USER, (user_id,))

    recipients: list[tuple[str, dict]] = [
        (
            contact["email"],
            {
                "contact_name": contact["name"],
                "user_name":    user_rows[0]["name"],
                "user_phone":   user_rows[0]["phone"],
                "timestamp":    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "latitude":     data.latitude,
                "longitude":    data.longitude,
                "map_url":      f"https://www.google.com/maps?q={data.latitude},{data.longitude}",
            },
        )
        for contact in contacts if contact["email"]
    ]

    if recipients:
        background_tasks.add_task(
            Mail.SendBulk,
            f"Panic alert from {user_rows[0]['name']}",
            "panic_alert",
            recipients,
        )

    return {"Skellent": "Success!"}
```

This is the endpoint that corresponds to hitting the panic button itself — the project's ultimate purpose (see `sql.md`, `alerts` section). A single endpoint, with no `GET`/`PUT` of its own yet: today no one needs to list or edit past alerts, only create them.

### Why only **confirmed** contacts get notified

`Queries.SELECT_CONFIRMED_CONTACTS_BY_USER` (see `cursor.md`), not `SELECT_CONTACTS_BY_USER`, is the query that decides who to notify. This isn't a technical limitation but the whole reason the `confirmed` column exists (see `sql.md`, `guard.md`): adding someone as an emergency contact doesn't automatically grant their consent to receive alerts on their behalf, and that person already had the chance to confirm it by clicking the link they got by email when they were added (`POST /contacts`, see above). A contact who never confirmed simply doesn't show up in this query and receives nothing — it isn't even attempted.

### Why `Mail.SendBulk` and not `Mail.Send` in a loop

Unlike `POST /contacts` (which always notifies **one** recipient, the just-created contact), `POST /alerts` may need to notify **several** confirmed contacts at once. Calling `Mail.Send` once per contact would open and close a separate SMTP connection for each one; `Mail.SendBulk` (see `mail.md`) opens a single connection and sends every email for that alert through it, while also guaranteeing that a contact with an invalid address doesn't stop the rest from receiving the notification. See `mail.md` for the complete detail of why this matters specifically here (and not before: up to this endpoint, every send in the project was one-to-one).

### Why in the background, same as contact confirmation

The `INSERT` into `alerts` — the durable record that the alert happened — is committed with `cursor.commit()` **before** trying to notify anyone, and the `201` response arrives as soon as that finishes. Queuing `Mail.SendBulk` with `background_tasks.add_task` (instead of a direct `await`) means whoever triggered the panic button doesn't wait for N emails to be sent to know their alert was logged — something particularly important here, where the app should confirm to the user that the alert fired as fast as possible, without Gmail's latency (or a contact with delivery issues) getting in the way.

### Why the email's `timestamp` doesn't come from a query against `alerts`

The template's context uses `datetime.now()`, computed at the moment of responding, not a `SELECT` of the just-inserted row (whose `created_at` MariaDB fills in with `DEFAULT CURRENT_TIMESTAMP`, see `sql.md`). In practice they're the same instant — an extra query isn't worth it just to show a value that's already known with more than enough precision for a notification email.

## Relationship with the rest of the backend

`main.py` imports the four modules in this directory and mounts their routers with `include_router` (see `main.md`). All of them depend on `modules/db.py` (the shared `cursor`), `modules/cursor.py` (`Queries` and, except for `contacts.py`/`alerts.py`, `DuplicateRecordError`) and `modules/types.py` (the Pydantic models for each request); `users.py`, `contacts.py` and `alerts.py` additionally depend on `modules/dependencies.py` to require authentication. `modules/guard.py` is used by both `auth.py` (creating the hash at registration, verifying it at login) and `users.py` (creating the hash when a user changes their own password); `modules/token.py` is used by `auth.py` (issuing the session JWT) and `contacts.py` (issuing and validating the confirmation token, see `token.md`) — `alerts.py` doesn't need it, since it neither issues nor validates any token of its own. `modules/mail.py` (see `mail.md`) is used by `contacts.py` (`Mail.Send`, 1 to 1) and `alerts.py` (`Mail.SendBulk`, 1 to N). `modules/pages.py` (see `pages.md`) is used only by `contacts.py`, to render the HTML result page `GET /contacts/confirm/{token}` shows instead of JSON.
