# `modules/cursor.py`

## Purpose

This module defines three pieces that work together to talk to MariaDB:

- **`Queries`**: a class that only holds string constants with the SQL statements the application uses.
- **`Cursor`**: a class that wraps `mariadb`'s connection and cursor, exposing a minimal API (`execute`, `commit`, `close`, `rowcount`) to the rest of the backend.
- **`DuplicateRecordError`**: a project-specific exception that translates a specific `mariadb` error into something the rest of the backend can understand without needing to know about `mariadb`.

## Why separate the SQL queries into `Queries`

The SQL strings (`SHOW_TABLES`, `INSERT_USER`, etc.) live as class attributes on `Queries` instead of being written directly where they're used (for example, inside the routers' endpoints, see `routers.md`). This keeps SQL text from being scattered and duplicated across the business logic, and gives each query a readable name (`Queries.INSERT_USER`) at its point of use. If a query changes, it's edited in exactly one place.

Note that every parameterized query (`INSERT_USER`, `SELECT_USER_BY_EMAIL`, `INSERT_CONTACT`, etc.) uses `%s` placeholders instead of interpolating values directly into the string. This is intentional and is the main defense against SQL injection: the actual values are passed as a tuple to the `execute` method, and it's the `mariadb` connector that escapes them correctly before sending them to the server.

The user and contact queries were added as each operation was needed (see `routers.md` for who calls each one):

- `SELECT_USER_BY_EMAIL`: also fetches `password_hash`, something `SELECT_USER_BY_ID` deliberately doesn't do. The first one is used by login, which needs the hash to compare it with `Guard.Verify` (see `guard.md`); the second is used by `GET /users/me`, which should never return the hash to the client, so that column isn't even selected — it's simpler to not fetch it from the database at all than to trust whoever assembles the response to remember to exclude a field.
- `INSERT_CONTACT` and `SELECT_CONTACTS_BY_USER` have no design rationale different from `INSERT_USER`: they follow the same pattern, just against the `contacts` table (see `sql.md`).
- `CONFIRM_CONTACT` (`UPDATE contacts SET confirmed = TRUE WHERE id = %s;`) is a fixed constant, unlike the partial edits in `users.py`/`contacts.py` (see below): it always touches the same column with the same fixed value (`TRUE`), never a variable subset of fields depending on what the client sent. That's why it fits in `Queries` instead of being built dynamically in the router — it's exactly the same case as `INSERT_USER`, only it's an `UPDATE` of a single constant field. `GET /contacts/confirm/{token}` (see `routers.md`, `mail.md`) uses it.
- `SELECT_CONFIRMED_CONTACTS_BY_USER` (`SELECT name, phone, email FROM contacts WHERE user_id = %s AND confirmed = TRUE;`) is a variant of `SELECT_CONTACTS_BY_USER` with a stricter `WHERE` and fewer columns: it doesn't fetch `id` (no one needs to edit these contacts, just email them) and filters by `confirmed = TRUE`. `POST /alerts` (see `routers.md`) uses it to decide who to notify when an alert fires — deliberately different from `SELECT_CONTACTS_BY_USER` (which does fetch every contact, confirmed or not, for `GET /contacts`) because they're two different questions: "who are my contacts?" versus "which of my contacts can I actually send an alert to?" See `mail.md` for why that distinction matters.
- `INSERT_ALERT` (`INSERT INTO alerts (user_id, latitude, longitude) VALUES (%s, %s, %s);`) follows the same pattern as `INSERT_USER`/`INSERT_CONTACT`: it doesn't include `created_at`, which the table fills in on its own via `DEFAULT CURRENT_TIMESTAMP` (see `sql.md`).
- There's no `UPDATE_USER` or `UPDATE_CONTACT` as a fixed constant in `Queries`. Unlike an `INSERT` (which always touches the same columns), a partial edit (`PUT /users/me`, `PUT /contacts/{id}`) should only touch the fields the client actually sent — if `Queries` had a single `UPDATE_USER` constant with all four fixed columns, every edit would be forced to rewrite columns the user never meant to change. That's why those two queries are built dynamically inside their respective routers (see `routers.md`), concatenating only the column names that correspond to the fields present. This stays safe even though column names are concatenated directly into the SQL string: what gets concatenated are *column names*, which can only come from a fixed, known-in-advance list (the Pydantic model's fields, see `types.md`), never from arbitrary text written by whoever calls the API — the only thing that travels parameterized with `%s` are the values, same as in every other query.

## Why wrap the connection in a `Cursor` class

`mariadb.connect()` and handling a raw cursor require several repetitive steps (opening the connection, creating a cursor, handling connection errors, committing, closing). Wrapping this in `Cursor` lets the rest of the application (`main.py`) work with three simple methods without worrying about driver details:

### `__init__`

Receives the already-resolved credentials (see `credentials.md`) and opens the connection. If the connection fails, `mariadb.Error` is caught, the reason is printed, and `sys.exit(1)` is called. This is a deliberate **fail-fast** decision: since `Cursor` is instantiated at module level in `main.py` (that is, when the application starts, not on every request), if the database is unavailable the entire process should stop instead of starting in a half-working state where every endpoint would later fail in a less clear way.

The cursor is created with `dictionary=True`, so each returned row is a `dict` (column → value) instead of a positional tuple. This makes results directly serializable to JSON by FastAPI and more readable/maintainable than relying on column order.

### `execute`

```python
def execute(self, query: str, params: tuple = ()) -> list[dict]:
    try:
        self.cursor.execute(query, params)
    except mariadb.IntegrityError as e:
        raise DuplicateRecordError(str(e)) from e
    try:
        return self.cursor.fetchall()
    except mariadb.ProgrammingError:
        return []
```

Runs any parameterized query and returns `self.cursor.fetchall()`. The second `try` catches `mariadb.ProgrammingError` around `fetchall()` because not every query returns rows: a `SELECT` does, but an `INSERT` or `UPDATE` has no result set to fetch, and the connector raises that exception when it's attempted. Wrapping both cases in a single method avoids having to expose two variants (`query` vs `execute`) to the rest of the code; the caller simply ignores the return value when running a write.

The first `try` is new and fixes a real bug: before, inserting a user with a `phone` or `email` that already existed (both are `UNIQUE` in the `users` table, see `sql.md`) made `mariadb` raise an uncaught `mariadb.IntegrityError`, which FastAPI converted into a generic `500 Internal Server Error` — the worst possible response for what is actually a predictable, client-caused case (they sent data that collides with something that already exists, not a server failure). Now `execute` intercepts that specific error and re-raises it as `DuplicateRecordError`, a project-specific exception defined earlier in this same file:

```python
class DuplicateRecordError(Exception):
    pass
```

The reason it's defined here, and not in the router that ends up using it (see `routers.md`), is that `cursor.py` is the only backend file that imports `mariadb` directly — it's, on purpose, the only point where the project knows the database is MariaDB and not something else. If the routers had to catch `mariadb.IntegrityError` themselves, they'd have to import `mariadb` too, leaking an infrastructure detail (which database engine is used) into the layer that should only care about HTTP. With `DuplicateRecordError` as an intermediary, a router can `except DuplicateRecordError` and respond `409 Conflict` without knowing `mariadb` even exists. If the project ever migrated to a different database engine, only this file would need to change.

### `rowcount`

```python
@property
def rowcount(self) -> int:
    return self.cursor.rowcount
```

Exposes how many rows the last executed query affected. It was added because `PUT /contacts/{id}` (see `routers.md`) needs to distinguish two situations that would otherwise look identical from the outside: "the `UPDATE` ran but didn't touch any row because that `id` doesn't exist or isn't yours" (should respond `404`) versus "the `UPDATE` ran and modified the row" (`200`). Since `Queries` filters those edits by `WHERE id = %s AND user_id = %s` (so no one can edit someone else's contact, see `sql.md`), a `rowcount` of `0` is exactly the signal for "not found or not authorized" — and since we don't want to reveal to the caller which of the two it was (to avoid confirming that a contact with that `id` exists and belongs to someone else), both cases return the same `404`.

It was implemented as a `@property` (not a `rowcount()` method) because, conceptually, it isn't an action you trigger but a piece of data that already exists as soon as the last query finished — reading it with `cursor.rowcount` instead of `cursor.rowcount()` better reflects that idea.

### `lastrowid`

```python
@property
def lastrowid(self) -> int:
    return self.cursor.lastrowid
```

Same rationale as `rowcount`: a piece of data already available as soon as the last `INSERT` finished, exposed as a read-only property. It was added because `POST /contacts` (see `routers.md`) needs the `id` of the just-created contact to generate its confirmation token (`Token.CreateContactConfirmation`, see `token.md`) — and `INSERT_CONTACT` doesn't return any rows (it's an `INSERT`, not a `SELECT`), so the only way to learn that `id` without an extra query is to ask the cursor what the last `AUTO_INCREMENT` it generated was, immediately after the `INSERT` and before any other query that could overwrite it.

### `commit` and `close`

Thin methods that delegate directly to the underlying connection. They're exposed explicitly because MariaDB, like most SQL engines, doesn't persist write changes until the transaction is committed — hence the routers calling `cursor.commit()` after every `INSERT` or `UPDATE` (see `routers.md`).

## Relationship with the rest of the backend

`modules/db.py` (see `db.md`) creates the single `Cursor` instance when the application starts (not one per request), and every router imports it from there to reuse it. It's a simple design, appropriate for the project's current state, but it means the whole application shares a single database connection.
