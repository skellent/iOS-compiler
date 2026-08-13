# `modules/credentials.py`

## Purpose

This module centralizes the reading of every sensitive credential and environment-specific setting the backend needs to function. It exposes a single function, `get_credentials()`, which returns a dictionary with that information.

## Why it exists as a separate module

Credentials (user, password, host, etc.) are never written into the source code or committed to git. Instead, they live in a `.env` file (see `backend/.envexample` for the template) that `python-dotenv` loads at runtime via `load_dotenv()`. Isolating this reading logic in its own module serves two purposes:

- **A single entry point**: if the configuration mechanism ever changes (for example, moving from environment variables to a secrets manager), only this file needs to change, not every place in the code that needs a credential.
- **Separating configuration from business logic**: the rest of the backend doesn't need to know *how* credentials are obtained, only that it can request them with a call to this function.

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
        "from":     ..., # defaults to "user" (SMTP_USER) if SMTP_FROM isn't set
    },
    "telegram": {
        "bot_token":      ..., # secret, from BotFather
        "bot_username":   ..., # without the leading "@", used to build t.me deep links
        "webhook_secret": ..., # arbitrary string Telegram echoes back on every webhook call
    },
    "api_base_url": ..., # defaults to "http://127.0.0.1:8000" if not in the environment
    "app_mode":     ..., # "Debug" or "Deploy", defaults to "Debug"
    "log_level":    ..., # defaults to "INFO" if not in the environment
}
```

The `database` section maps directly to the parameters `mariadb.connect()` expects (see `cursor.md`), and is built by reading the `USERNAME`, `PASSWORD`, `HOST`, `PORT` and `DATABASE` environment variables. `PORT` is explicitly converted with `int(...)`, since every environment variable arrives as a text string and the MariaDB connector expects a numeric port.

The `api` section is present but not used yet (`Auth` and `Key` are `None`). It's an intentional placeholder: the project plans to add an external service for dispatching alerts (SMS, push notifications, etc.) that will need its own credentials, and the dictionary's shape was left ready so `get_credentials()` won't need to be restructured once that work starts.

The `jwt` section's `secret_key` reads the `JWT_SECRET_KEY` environment variable, the symmetric key `modules/token.py` uses to sign and verify every JWT the backend issues — session tokens as well as contact- and user-confirmation tokens (see `token.md`). It lives in this dictionary instead of being read directly with `os.getenv` inside `token.py` so as not to break the pattern already established: everything the backend needs from the environment goes through this single function. If it were ever leaked, whoever obtained it could sign valid tokens for any user or confirmation they wanted — it's just as sensitive as the database password.

## The `email` section

```python
"email": {
    'user':     os.getenv("SMTP_USER"),
    'password': os.getenv("SMTP_PASSWORD"),
    'host':     os.getenv("SMTP_HOST", "smtp.gmail.com"),
    'port':     int(os.getenv("SMTP_PORT", 587)),
    'from':     os.getenv("SMTP_FROM", os.getenv("SMTP_USER")),
},
```

Used by `modules/mail.py` (see `mail.md`) to authenticate against `smtp.gmail.com` (Google Workspace) using an *App Password* instead of the account's real password — see `mail.md` for the reasoning behind that choice and its client-side preconditions. `host` and `port` default to Gmail's own values directly in the `os.getenv` call, since those don't need to be repeated in every `.env` — only `user` and `password` are mandatorily account-specific.

`user` and `from` are deliberately two separate values, even though for most deployments they're the same address. `user` is always the real Google Workspace account SMTP authenticates as — it's what Gmail checks the app password against, and it never changes. `from` is only what ends up in the outgoing message's `From:` header, and only needs to be set explicitly (`SMTP_FROM`) when the desired sender address isn't the authenticating account itself but a domain alias of it (for example, authenticating as `soporte@keycodelogics.com` while sending as `support@panicbutton.me`, when `panicbutton.me` is configured in Workspace as a domain alias of `keycodelogics.com` rather than an independent, separately-licensed secondary domain). Gmail's SMTP servers accept a `From:` that doesn't match the authenticated account only when that address is already a verified alias of it — otherwise it silently rewrites `From:` back to `user`, so `SMTP_FROM` being set is not, on its own, a guarantee the domain-alias side is configured correctly. `from` defaults to `user` when `SMTP_FROM` isn't set, so a `.env` written before this variable existed keeps behaving exactly as before.

## The `telegram` section

```python
"telegram": {
    'bot_token':      os.getenv("TELEGRAM_BOT_TOKEN"),
    'bot_username':   os.getenv("TELEGRAM_BOT_USERNAME"),
    'webhook_secret': os.getenv("TELEGRAM_WEBHOOK_SECRET"),
},
```

Used by `modules/telegram.py` (see `telegram.md`) and `main.py`'s startup hook. `bot_token` authenticates every call to `https://api.telegram.org/bot{token}/...` — as sensitive as the JWT secret, since anyone holding it can send messages as the bot. `bot_username` (no `@` prefix) is what `POST /contacts/{id}/telegram/enable` uses to build a `https://t.me/{bot_username}?start={token}` deep link — it's not secret, but it's still environment-specific (a `Debug` bot and a `Deploy` bot would have different usernames), so it lives here rather than being hardcoded. `webhook_secret` is a value **this project makes up**, not something Telegram issues: it's registered via `setWebhook`'s `secret_token` parameter, and Telegram echoes it back on the `X-Telegram-Bot-Api-Secret-Token` header of every webhook call afterwards, which is how `POST /telegram/webhook` tells a genuine Telegram update apart from anyone else who discovers the endpoint's URL and tries to post a forged one.

## `api_base_url`

```python
"api_base_url": os.getenv("API_BASE_URL", "http://127.0.0.1:8000"),
```

The public URL the API uses to build the absolute links it emails out — a contact's confirmation link (`{api_base_url}/contacts/confirm/{token}`) and a new user's confirmation link (`{api_base_url}/auth/confirm/{token}`, see `mail.md`, `routers.md`). This is necessary because, running behind nginx (see root `NGINX.md`), the `uvicorn` process has no way of knowing on its own the domain the outside world reaches it through.

## `app_mode`

```python
"app_mode": os.getenv("APP_MODE", "Debug"),
```

The switch `main.py` reads to decide whether FastAPI's automatic documentation (`/docs`, `/redoc`, `/openapi.json`) should be exposed — see `main.md` for the detail of how it's used there. It takes one of two values, `"Debug"` or `"Deploy"`; anything else (including not setting `APP_MODE` at all) is treated as `"Debug"`, so local development keeps the docs on by default and a deployment has to opt into hiding them explicitly by setting `APP_MODE=Deploy`.

## `log_level`

```python
"log_level": os.getenv("LOG_LEVEL", "INFO"),
```

Read once, at import time, by `modules/logs.py` (see `logs.md`) to decide the minimum severity that gets written to both the console and `backend/logs/panicbutton.log`. It's plain text (`"DEBUG"`, `"INFO"`, `"WARNING"`, ...), matched against Python's own `logging` level names — an unrecognized value falls back to `INFO` rather than raising, the same "never let a config typo crash startup" posture `app_mode` takes above. There's no dedicated `logging` section in this dictionary, unlike `email` or `telegram`, because it's the only setting `modules/logs.py` needs; wrapping a single value in its own sub-dict would add a level of nesting without organizing anything.

## Relationship with the rest of the backend

`modules/db.py` (see `db.md`) calls `get_credentials()` once, when the application starts, and uses the result's `database` section to build the connection's `Cursor`. `modules/token.py` (see `token.md`) calls it at module level to read `jwt.secret_key` once. `modules/mail.py` (see `mail.md`) does the same with the `email` section. `modules/telegram.py` and `modules/routers/alerts.py` read `api_base_url` to build absolute links (a `t.me` deep link and the map/webhook URLs, respectively — see `telegram.md`, `routers.md`); `modules/routers/contacts.py` reads it too, for confirmation links. `main.py` reads `app_mode` once, at module level, to decide whether to expose the automatic docs. `modules/logs.py` reads `log_level` once, at import time, to configure the root logger before anything else in the backend has a chance to log anything (see `logs.md`). Since `load_dotenv()` doesn't fail if the `.env` file doesn't exist, a deployment without that file will simply produce `None` values that later cause the MariaDB connection to fail in `Cursor.__init__` (see `cursor.md`), token signing in `token.py`, or email sending in `mail.py`, instead of a more descriptive error at this point — `app_mode` and `log_level` are the exceptions, since both always fall back to a default regardless of whether `.env` exists.
