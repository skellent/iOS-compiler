# `modules/credentials.py`

## Purpose

This module centralizes the reading of every sensitive credential the backend needs to function (for now, the database's; in the future, the external API's that dispatches alerts). It exposes a single function, `get_credentials()`, which returns a dictionary with that information.

## Why it exists as a separate module

Credentials (user, password, host, etc.) are never written into the source code or committed to git. Instead, they live in a `.env` file (see `backend/.envexample` for the template) that `python-dotenv` loads at runtime via `load_dotenv()`. Isolating this reading logic in its own module serves two purposes:

- **A single entry point**: if the configuration mechanism ever changes (for example, moving from environment variables to a secrets manager), only this file needs to change, not every place in the code that needs a credential.
- **Separating configuration from business logic**: `main.py` doesn't need to know *how* credentials are obtained, only that it can request them with a call to this function.

## Structure of the returned dictionary

```python
{
    "database": {
        "user":     ...,
        "password": ...,
        "host":     ...,
        "port":     ...,  # explicitly converted to int
        "database": ...,
    },
    "api": { # not yet the final shape of the third-party API
        "Auth": None,
        "Key":  None,
    },
    "jwt": {
        "secret_key": ...,
    },
    "email": {
        "user":     ...,
        "password": ...,
        "host":     ..., # defaults to "smtp.gmail.com" if not in the environment
        "port":     ..., # defaults to 587 if not in the environment, converted to int
    },
    "api_base_url": ..., # defaults to "http://127.0.0.1:8000" if not in the environment
}
```

The `database` section maps directly to the parameters `mariadb.connect()` expects (see `modules/cursor.py`), and is built by reading the `USERNAME`, `PASSWORD`, `HOST`, `PORT` and `DATABASE` environment variables. Note that `PORT` is explicitly converted with `int(...)`, since every environment variable arrives as a text string and the MariaDB connector expects a numeric port.

The `api` section is present but not used yet (`Auth` and `Key` are `None`). It's an intentional placeholder: the project plans to add an external service for dispatching alerts (SMS, push notifications, etc.) that will need its own credentials, and the dictionary's shape was left ready so `get_credentials()` won't need to be restructured once that work starts.

The `jwt` section, on the other hand, is already in use: `secret_key` reads the `JWT_SECRET_KEY` environment variable, the symmetric key `modules/token.py` uses to sign and verify login JSON Web Tokens (see `token.md`). It was added to this dictionary instead of being read directly with `os.getenv` inside `token.py` so as not to break the pattern already established: everything the backend needs from the environment goes through this single function, so if the JWT secret ever had to come from a secrets manager instead of a `.env` file, only this file would change. Unlike `database`, no type conversion is needed: `JWT_SECRET_KEY` is used as-is, as the text string it already is.

Like any other credential in this dictionary, `JWT_SECRET_KEY` lives only in `.env` (outside git), and its template is documented in `.envexample`. If it were ever leaked, whoever obtained it could sign valid tokens for any `user_id` they wanted — in that sense, it's just as sensitive as the database password.

## The `email` section

```python
"email": {
    'user':     os.getenv("SMTP_USER"),
    'password': os.getenv("SMTP_PASSWORD"),
    'host':     os.getenv("SMTP_HOST", "smtp.gmail.com"),
    'port':     int(os.getenv("SMTP_PORT", 587)),
},
```

Added alongside `modules/mail.py` (see `mail.md`) to authenticate against `smtp.gmail.com` (Google Workspace, account `soporte@keylogics.com`) using an *App Password* instead of the account's real password — see `mail.md` for the reasoning behind that choice and its client-side preconditions. Unlike `database` and `jwt`, `host` and `port` have default values (`smtp.gmail.com` and `587`) directly in the `os.getenv` call, because those are reasonable defaults for Gmail that shouldn't need to be repeated in every `.env` — only `user` and `password` are mandatorily account-specific.

## `api_base_url`

```python
"api_base_url": os.getenv("API_BASE_URL", "http://127.0.0.1:8000"),
```

Not a credential, but added to this same dictionary for consistency (everything the backend needs from the environment goes through `get_credentials()`). It's the public URL the API uses to build a contact's confirmation link (`{api_base_url}/contacts/confirm/{token}`, see `mail.md`) — necessary because, running behind nginx (see `NGINX.md`), the `uvicorn` process has no way of knowing on its own the domain the outside world reaches it through.

## `app_mode`

```python
"app_mode": os.getenv("APP_MODE", "Debug"),
```

Also not a credential, added for the same reason as `api_base_url`. It's the switch `main.py` reads to decide whether FastAPI's automatic documentation (`/docs`, `/redoc`, `/openapi.json`) should be exposed — see `main.md` for the detail of how it's used there. It takes one of two values, `"Debug"` or `"Deploy"`; anything else (including not setting `APP_MODE` at all) is treated as `"Debug"`, so local development keeps the docs on by default and a deployment has to opt into hiding them explicitly by setting `APP_MODE=Deploy`.

## Relationship with the rest of the backend

It's no longer only `main.py` that consumes this module. `modules/db.py` (see `db.md`) calls `get_credentials()` once, when the application starts, and uses the result's `database` section to build the connection's `Cursor`. `modules/token.py` (see `token.md`) also calls it, at module level, to read `jwt.secret_key` once and store it in a private module variable instead of re-reading it on every `Token.Create`/`Token.Validate` call. `modules/mail.py` (see `mail.md`) does the same with the `email` section, `modules/routers/contacts.py` reads `api_base_url` directly to build the confirmation link, and `main.py` reads `app_mode` once, at module level, to decide whether to expose the automatic docs. Since `load_dotenv()` doesn't fail if the `.env` file doesn't exist, a deployment without that file will simply produce `None` values that will later cause the MariaDB connection to fail in `Cursor.__init__` (see `cursor.md`), token signing in `token.py`, or email sending in `mail.py`, instead of a more descriptive error at this point — `app_mode` is the one exception, since it always falls back to `"Debug"` regardless of whether `.env` exists.
