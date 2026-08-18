# Operations

Environment variables, logging, feature flags, and the one maintenance script — everything an operator (not a developer reading the code) needs.

## Environment variables (`credentials.py`)

`get_credentials()` reads `.env` (`python-dotenv`, `override=True` — see note below) and returns one dict, grouped by concern:

| Group | Variables | Notes |
|---|---|---|
| Database | `USERNAME`, `PASSWORD`, `HOST`, `PORT`, `DATABASE` | See [`database.md`](database.md) |
| JWT | `JWT_SECRET_KEY` | Sign/verify session + confirmation tokens, see [`auth.md`](auth.md) |
| SMTP | `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_HOST` (default `smtp.gmail.com`), `SMTP_PORT` (default `587`), `SMTP_FROM` (defaults to `SMTP_USER`), `SMTP_ENABLED` (default `true`), `SMTP_VERIFY_DELIVERABILITY` (default `true`) | See [`notifications.md`](notifications.md) |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | All optional — unset means the feature is simply off |
| General | `API_BASE_URL` (default `http://127.0.0.1:8000`), `APP_MODE` (default `Debug`), `LOG_LEVEL` (default `INFO`) | |

`override=True` matters specifically on Windows: the OS predefines its own `USERNAME` environment variable (the logged-in Windows account), and `load_dotenv()` leaves existing environment variables alone by default — without `override=True`, `.env`'s own `USERNAME` (the MariaDB user) silently loses to whatever Windows account happens to be running the process.

`SMTP_PASSWORD` is a 16-character Google Workspace **app password**, not the account's real password (Gmail hasn't accepted basic SMTP auth on Workspace accounts since March 2025) — generate one at `myaccount.google.com/apppasswords` with 2-Step Verification on. `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME` come from Telegram's `@BotFather` (`/newbot`); `TELEGRAM_WEBHOOK_SECRET`, like `JWT_SECRET_KEY`, is a random string this deployment invents:

```bash
uv run python -c "import secrets; print(secrets.token_hex(32))"
```

Generate a separate value per environment (dev, prod) for both secrets — never reuse one across them, never commit `.env` (already gitignored).

`SMTP_ENABLED=false` logs outgoing mail instead of sending it, and `SMTP_VERIFY_DELIVERABILITY=false` skips the recipient-domain check (see [`notifications.md`](notifications.md)) — both meant for local development (the second for working offline, where DNS lookups can't be made). Production leaves both at their `true` default, and the process needs outbound DNS for the deliverability check to run.

## Rate limiting

`POST /auth/register`, `POST /auth/login` and `POST /alerts` are rate-limited (`slowapi`); over the limit the request gets a `429` before the handler runs. Login and register are keyed by client address — so registration can't be scripted into an unauthenticated email sender, and passwords can't be guessed unbounded — while `POST /alerts` is keyed by user id, so one account on a shared network can't consume everyone else's allowance. Behind a reverse proxy the real client address only reaches the limiter if the proxy forwards it (`X-Forwarded-For`) and Uvicorn is run with `--proxy-headers`; otherwise every request appears to come from the proxy and shares one bucket.

## Health check — `GET /health`

Returns `{"status": "ok", "database": true}` with a `200` when the database is reachable, or a `503` when it isn't — a single endpoint a process supervisor or uptime monitor can poll. The same reachability is checked once at startup, and the process refuses to boot if the database can't be reached, so a misconfiguration surfaces immediately rather than on the first request.

## Logging (`logs.py`)

Standard library `logging`, one shared config applied at import time: console (stdout) + a rotating file (`backend/logs/panicbutton.log`, 5 MB × 3 backups, gitignored). `LOG_LEVEL` sets the minimum severity for both handlers — `DEBUG`/`INFO`/`WARNING`/`ERROR`/`CRITICAL`, defaults to `INFO` if unset or misspelled. Every module gets its own named logger via `get_logger(__name__)`, so log lines show which module they came from. Each line also carries a short request id, assigned per request by `main.py`'s middleware and inherited by the background tasks that request spawns, so the log for one panic alert (and its email/Telegram fan-out) can be followed end to end even while other requests interleave. The `httpx` client's own request logging is pinned to `WARNING`, so the Telegram API URL — which embeds the bot token — never lands in the log file.

## Feature flags — `GET /features`

```json
{"telegram": true, "max_contacts": 4}
```

`telegram` is whether this deployment has Telegram fully configured (both `TELEGRAM_BOT_TOKEN` *and* `TELEGRAM_BOT_USERNAME` set — either alone means a contact who tries to link Telegram would hit a broken link). `max_contacts` is the emergency-contact cap, served from the backend so the app enforces the same number the backend does rather than hardcoding its own. Unauthenticated, cached client-side for the app's session (`app/src/lib/features.js`) — used to hide Telegram UI entirely on a deployment that doesn't have a bot configured, rather than showing a feature that would just fail.

## Maintenance script

```bash
uv run scripts/purge_unconfirmed_users.py
```

Deletes accounts still unconfirmed 24h after signup. Safe by construction: login is blocked pre-confirmation, so an unconfirmed account can never own contacts or alerts — there's nothing this script could delete that anything else references. Meant to run periodically (cron or similar); it isn't wired into the API or run automatically by anything in this repo.
