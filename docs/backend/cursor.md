# `modules/cursor.py`

## Purpose

This module defines three pieces that work together to talk to MariaDB:

- **`Queries`**: a class that only holds string constants with the SQL statements the application uses.
- **`Cursor`**: a class that wraps `mariadb`'s connection and cursor, exposing a minimal API (`execute`, `commit`, `close`, `rowcount`, `lastrowid`) to the rest of the backend.
- **`DuplicateRecordError`**: a project-specific exception that translates a specific `mariadb` error into something the rest of the backend can understand without needing to know about `mariadb`.

## Why separate the SQL queries into `Queries`

The SQL strings (`SHOW_TABLES`, `INSERT_USER`, etc.) live as class attributes on `Queries` instead of being written directly where they're used (for example, inside the routers' endpoints, see `routers.md`). This keeps SQL text from being scattered and duplicated across the business logic, and gives each query a readable name (`Queries.INSERT_USER`) at its point of use. If a query changes, it's edited in exactly one place.

Note that every parameterized query uses `%s` placeholders instead of interpolating values directly into the string. This is intentional and is the main defense against SQL injection: the actual values are passed as a tuple to the `execute` method, and it's the `mariadb` connector that escapes them correctly before sending them to the server.

```python
class Queries:
    SHOW_TABLES: str = "SHOW TABLES;"
    INSERT_USER: str = "INSERT INTO users (name, phone, email, password_hash) VALUES (%s, %s, %s, %s);"
    SELECT_USER_BY_EMAIL: str = "SELECT id, name, phone, email, password_hash, confirmed FROM users WHERE email = %s;"
    SELECT_USER_BY_ID: str = "SELECT id, name, phone, email FROM users WHERE id = %s;"

    INSERT_CONTACT: str = "INSERT INTO contacts (user_id, name, phone, email) VALUES (%s, %s, %s, %s);"
    SELECT_CONTACTS_BY_USER: str = "SELECT id, name, phone, email, confirmed, (telegram_chat_id IS NOT NULL) AS telegram_linked FROM contacts WHERE user_id = %s;"
    SELECT_CONFIRMED_CONTACTS_BY_USER: str = "SELECT name, phone, email, telegram_chat_id FROM contacts WHERE user_id = %s AND (confirmed = TRUE OR telegram_chat_id IS NOT NULL);"
    CONFIRM_CONTACT: str = "UPDATE contacts SET confirmed = TRUE WHERE id = %s;"
    DELETE_CONTACT: str = "DELETE FROM contacts WHERE id = %s AND user_id = %s;"

    SET_CONTACT_TELEGRAM_LINK_TOKEN: str = "UPDATE contacts SET telegram_link_token = %s, telegram_link_expires_at = %s WHERE id = %s AND user_id = %s;"
    SELECT_CONTACT_BY_TELEGRAM_TOKEN: str = "SELECT contacts.id, contacts.name AS contact_name, users.name AS user_name FROM contacts JOIN users ON users.id = contacts.user_id WHERE contacts.telegram_link_token = %s AND contacts.telegram_link_expires_at > NOW();"
    CONFIRM_CONTACT_TELEGRAM: str = "UPDATE contacts SET telegram_chat_id = %s, telegram_link_token = NULL, telegram_link_expires_at = NULL WHERE id = %s;"
    CLEAR_CONTACT_TELEGRAM: str = "UPDATE contacts SET telegram_chat_id = NULL, telegram_link_token = NULL, telegram_link_expires_at = NULL WHERE id = %s AND user_id = %s;"

    CONFIRM_USER: str = "UPDATE users SET confirmed = TRUE WHERE id = %s;"
    PURGE_UNCONFIRMED_USERS: str = "DELETE FROM users WHERE confirmed = FALSE AND created_at < (NOW() - INTERVAL 24 HOUR);"

    INSERT_ALERT: str = "INSERT INTO alerts (user_id, latitude, longitude) VALUES (%s, %s, %s);"
```

- `SELECT_USER_BY_EMAIL` fetches both `password_hash` and `confirmed`, the only query in the project that exposes the hash — it's the one `POST /auth/login` (see `routers.md`) needs to verify a password and to decide whether the account is allowed to log in at all. `SELECT_USER_BY_ID` deliberately fetches neither: it backs `GET /users/me`, which should never return the hash to the client, and doesn't need to re-confirm an identity the caller already proved with a valid session token.
- `CONFIRM_CONTACT` and `CONFIRM_USER` are fixed constants, unlike the partial edits in `users.py`/`contacts.py` (see below): each always touches the same column with the same fixed value (`TRUE`), never a variable subset of fields depending on what the client sent. `GET /contacts/confirm/{token}` and `GET /auth/confirm/{token}` (see `routers.md`, `mail.md`) use them respectively.
- `DELETE_CONTACT` filters by both `id` and `user_id` in the same statement, the same ownership-scoping pattern `PUT /{contact_id}` already uses (see `routers.md`) — a contact that exists but belongs to someone else is indistinguishable, from the caller's point of view, from one that doesn't exist at all.
- `PURGE_UNCONFIRMED_USERS` is the only query in this class not called from a router — it backs `scripts/purge_unconfirmed_users.py` (see `scripts.md`), a standalone maintenance job, not an HTTP endpoint.
- `SELECT_CONFIRMED_CONTACTS_BY_USER` is a variant of `SELECT_CONTACTS_BY_USER` with a stricter `WHERE` and fewer columns: it doesn't fetch `id` (no one needs to edit these contacts, just notify them) and filters by `confirmed = TRUE OR telegram_chat_id IS NOT NULL` — either channel alone is enough to be notified, they aren't sequential steps. `POST /alerts` uses it to decide who to notify when an alert fires — a different question than `SELECT_CONTACTS_BY_USER` (which returns every contact, confirmed or not, for `GET /contacts`, alongside a computed `telegram_linked` boolean so the app can show connection status without exposing the raw `chat_id`).
- `SET_CONTACT_TELEGRAM_LINK_TOKEN`, `SELECT_CONTACT_BY_TELEGRAM_TOKEN`, `CONFIRM_CONTACT_TELEGRAM` and `CLEAR_CONTACT_TELEGRAM` back the Telegram-linking flow end to end — see `telegram.md` for the full sequence. Like `DELETE_CONTACT`, the ones that mutate on the app-user's behalf (`SET_CONTACT_TELEGRAM_LINK_TOKEN`, `CLEAR_CONTACT_TELEGRAM`) scope by `id AND user_id`; `SELECT_CONTACT_BY_TELEGRAM_TOKEN` and `CONFIRM_CONTACT_TELEGRAM` don't, because by that point in the flow the caller is Telegram itself (via the webhook), not an authenticated app user — the token, not `user_id`, is what proves which contact this request is about.
- There's no fixed `UPDATE_USER` or `UPDATE_CONTACT` constant: a partial edit (`PUT /users/me`, `PUT /contacts/{id}`) should only touch the fields the client actually sent, so those queries are built dynamically inside their respective routers instead (see `routers.md`), concatenating only the column names that correspond to the fields present. This stays safe even though column names are concatenated directly into the SQL string: what gets concatenated are *column names*, which can only come from a fixed, known-in-advance list (the Pydantic model's fields, see `types.md`), never from arbitrary text written by whoever calls the API — the only thing that travels parameterized with `%s` are the values, same as in every other query.

## Why wrap the connection in a `Cursor` class

`mariadb.connect()` and handling a raw cursor require several repetitive steps (opening the connection, creating a cursor, handling connection errors, committing, closing). Wrapping this in `Cursor` lets the rest of the application (`modules/db.py`) work with a handful of simple methods without worrying about driver details.

### `__init__` and `_connect`

```python
def __init__(self, username: str, password: str, host: str, port: int, database: str):
    self._username = username
    self._password = password
    self._host     = host
    self._port     = port
    self._database = database
    self._connect()

def _connect(self) -> None:
    try:
        self.conn = mariadb.connect(
            user        = self._username,
            password    = self._password,
            host        = self._host,
            port        = self._port,
            database    = self._database,
            client_flag = CLIENT.FOUND_ROWS,
            autocommit  = True,
        )
    except mariadb.Error as e:
        print(f"Error connecting to MariaDB: {e}")
        sys.exit(1)
    self.cursor = self.conn.cursor(dictionary=True)
```

`__init__` stores the credentials instead of using them once and discarding them, because `_connect` needs to be callable again later, not just at startup (see the reconnect behavior in `execute`, below). Opening the actual connection is factored into its own `_connect` method rather than inlined in `__init__` for exactly that reason: it's the same logic needed in two different moments (first boot, and recovering from a dropped connection), so it only exists once.

If the very first connection attempt fails, `mariadb.Error` is caught, the reason is printed, and `sys.exit(1)` is called. This is a deliberate **fail-fast** decision: since `Cursor` is instantiated at module level in `modules/db.py` (that is, when the application starts, not on every request), if the database is unreachable at that point the entire process should refuse to start instead of coming up in a half-working state where every endpoint would later fail in a less obvious way.

The cursor is created with `dictionary=True`, so each returned row is a `dict` (column → value) instead of a positional tuple — directly serializable to JSON by FastAPI and more readable than relying on column order.

Two connection options matter beyond the basics:

- **`client_flag=CLIENT.FOUND_ROWS`**: without it, an `UPDATE` that matches a row but doesn't actually change any of its values reports `rowcount = 0` — indistinguishable, from the caller's side, from "no row matched the `WHERE` clause at all." Every existence/ownership check in this codebase (`PUT /contacts/{id}`, `GET /contacts/confirm/{token}`, `GET /auth/confirm/{token}`, `DELETE /contacts/{id}`, see `routers.md`) reads `rowcount == 0` as "not found," so `rowcount` has to mean "rows matched," not "rows whose data actually changed." A contact confirming a link a second time, or an already-confirmed account revisiting its own confirmation email, are both legitimate cases where the row exists but nothing about it needs to change — `FOUND_ROWS` is what keeps those from surfacing as a false 404.
- **`autocommit=True`**: every write in this codebase already calls `commit()` explicitly after `execute()`, so this isn't what makes writes durable. What it prevents is a row staying locked by an open, never-committed transaction on this one shared connection (see `db.md` for why there's a single connection at all) — which can happen just from a plain `SELECT`, or from any code path that returns before reaching its own `commit()` call. With `autocommit` on, every individual statement is its own transaction, closed the moment it finishes, so a forgotten `commit()` anywhere can't wedge a row (or the whole connection) for whoever writes to it next.

### `execute`

```python
def execute(self, query: str, params: tuple = ()) -> list[dict]:
    try:
        self.cursor.execute(query, params)
    except mariadb.IntegrityError as e:
        raise DuplicateRecordError(str(e)) from e
    except mariadb.InterfaceError:
        self._connect()
        self.cursor.execute(query, params)
    try:
        return self.cursor.fetchall()
    except mariadb.ProgrammingError:
        return []
```

Runs any parameterized query and returns `self.cursor.fetchall()`. The last `try` catches `mariadb.ProgrammingError` around `fetchall()` because not every query returns rows: a `SELECT` does, but an `INSERT`, `UPDATE` or `DELETE` has no result set to fetch, and the connector raises that exception when it's attempted. Wrapping both cases in a single method avoids exposing two variants (`query` vs `execute`) to the rest of the code; the caller simply ignores the return value when running a write.

The first `except` intercepts `mariadb.IntegrityError` — raised when a write violates a `UNIQUE` constraint (`phone`/`email` on `users`, see `sql.md`) — and re-raises it as `DuplicateRecordError`, a project-specific exception defined earlier in this same file:

```python
class DuplicateRecordError(Exception):
    pass
```

It's defined here, and not in the router that ends up using it (see `routers.md`), because `cursor.py` is the only backend file that imports `mariadb` directly — it's, on purpose, the only point where the project knows the database is MariaDB and not something else. If the routers had to catch `mariadb.IntegrityError` themselves, they'd have to import `mariadb` too, leaking an infrastructure detail (which database engine is used) into the layer that should only care about HTTP. With `DuplicateRecordError` as an intermediary, a router can `except DuplicateRecordError` and respond `409 Conflict` without knowing `mariadb` even exists.

The second `except` catches `mariadb.InterfaceError`, the error MariaDB raises when a query is sent over a connection the server already closed on its own side — typically because the connection sat idle longer than the server's `wait_timeout` and got dropped hours after the last query, long before this one. Since the whole application shares a single long-lived connection (see `db.md`), this isn't a hypothetical: any connection that survives past that timeout eventually hits it. Rather than letting the request fail outright, `execute` reconnects (`self._connect()`) and retries the exact same query once. If the retry also fails, the exception propagates normally — this handles the ordinary "the connection went stale" case without trying to paper over a database that's genuinely unreachable.

### `rowcount`

```python
@property
def rowcount(self) -> int:
    return self.cursor.rowcount
```

Exposes how many rows the last executed query matched. It's what lets an endpoint like `PUT /contacts/{id}` distinguish "the `UPDATE` ran but touched no row because that `id` doesn't exist or isn't mine" (should respond `404`) from "the `UPDATE` ran and matched the row" (`200`) — see the `client_flag=CLIENT.FOUND_ROWS` note above for why this only means what it should with that connection option set. It was implemented as a `@property`, not a `rowcount()` method, because it isn't an action being triggered but a piece of data that already exists as soon as the last query finished.

### `lastrowid`

```python
@property
def lastrowid(self) -> int:
    return self.cursor.lastrowid
```

Same rationale as `rowcount`: a piece of data already available as soon as the last `INSERT` finished, exposed as a read-only property. `POST /contacts` and `POST /auth/register` both need the `id` of the row they just created — the first to generate a contact-confirmation token, the second to generate a user-confirmation token (see `token.md`) — and neither `INSERT` returns any rows on its own, so the only way to learn that `id` without a second query is to ask the cursor what the last `AUTO_INCREMENT` value it generated was, immediately after the `INSERT` and before any other query that could overwrite it.

### `commit` and `close`

Thin methods that delegate directly to the underlying connection. `commit()` is called explicitly after every write in the routers, which is what actually persists the change; `autocommit=True` (above) is a safety net against a *missing* `commit()`, not a reason to stop calling it. `close()` exists for completeness (closing the cursor, then the connection) but isn't called anywhere in normal operation — the process holds this connection open for its entire lifetime.

## Relationship with the rest of the backend

`modules/db.py` (see `db.md`) creates the single `Cursor` instance when the application starts (not one per request), and every router imports it from there to reuse it. `scripts/purge_unconfirmed_users.py` (see `scripts.md`) imports the same shared `cursor` the same way a router would — from the database's point of view, a script run and an HTTP request look identical. It's a simple design, appropriate for the project's current scale, but it means the whole application — API and scripts alike — shares a single database connection.
