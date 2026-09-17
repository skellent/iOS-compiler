# Operations

Everything an operator needs: environment variables, logging, rate limits, feature flags, health checks, migrations and the maintenance script.

## Environment variables

`get_credentials()` (in `modules/credentials.py`) loads `.env` with `python-dotenv` (`override=True`) and returns one grouped dict. Missing required values raise a clear `MissingCredentialError` at startup.

| Group | Variables | Notes |
|---|---|---|
| **Database** | `USERNAME`, `PASSWORD`, `HOST`, `PORT`, `DATABASE` | Required. See [database.md](database.md). |
| **JWT** | `JWT_SECRET_KEY` | Required. Signs every token; use 32+ random bytes. |
| **Email (SMTP)** | `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_HOST` (default `smtp.gmail.com`), `SMTP_PORT` (default `587`), `SMTP_FROM` (default `SMTP_USER`), `SMTP_ENABLED` (default `true`), `SMTP_VERIFY_DELIVERABILITY` (default `true`) | All optional. See [notifications.md](notifications.md). |
| **Telegram** | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | Optional. All three needed for the channel to be live. |
| **Twilio (shared)** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Shared by the WhatsApp and SMS channels. |
| **WhatsApp** | `TWILIO_WHATSAPP_FROM`, `TWILIO_WHATSAPP_JOIN_KEYWORD`, `TWILIO_WHATSAPP_TEMPLATE_SID`, `TWILIO_WHATSAPP_ENABLED` (default `true`), `TWILIO_VALIDATE_SIGNATURE` (default `true`) | See [twilio.md](twilio.md). |
| **SMS** | `TWILIO_SMS_FROM`, `TWILIO_SMS_ENABLED` (default `true`) | See [twilio.md](twilio.md). |
| **General** | `API_BASE_URL` (default `http://127.0.0.1:8000`), `MAP_TILE_URL`, `MAP_TILE_ATTRIBUTION`, `APP_MODE` (default `Debug`), `LOG_LEVEL` (default `INFO`) | `API_BASE_URL` must be public HTTPS in production. Map settings control the embedded contact map. |

**Dry-run switches.** `SMTP_ENABLED`, `TWILIO_WHATSAPP_ENABLED` and `TWILIO_SMS_ENABLED` set to `false` log what *would* have been sent instead of sending it — meant for local development against real accounts. `SMTP_VERIFY_DELIVERABILITY=false` skips the recipient-domain DNS check (for working offline). Production leaves them all at their `true` default.

**Secrets.** `JWT_SECRET_KEY` and `TELEGRAM_WEBHOOK_SECRET` are values this deployment invents. Generate a distinct value per environment and never commit `.env`:

```bash
uv run python -c "import secrets; print(secrets.token_hex(32))"
```

`SMTP_PASSWORD` for Gmail/Workspace is a 16-character **app password**, not the account password.

## Enabling / disabling a channel

A channel is offered to the app only when its credentials are present. `GET /features` reports this, and the app hides a channel's UI when it is off:

| Channel | On when these are all set | Turn off by clearing |
|---|---|---|
| Telegram | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` | `TELEGRAM_BOT_TOKEN` |
| WhatsApp | `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_WHATSAPP_FROM` | `TWILIO_WHATSAPP_FROM` |
| SMS | `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_SMS_FROM` | `TWILIO_SMS_FROM` |

WhatsApp and SMS **share** `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`, so clear each channel's own `*_FROM` to disable just that one. Changes require a restart (credentials are read once at startup).

## Rate limiting

`POST /auth/register`, `POST /auth/login` and `POST /alerts` are rate-limited with `slowapi`; over the limit returns `429`. Login/register are keyed by client address, alerts by user id. Behind a proxy the real client address only reaches the limiter if the proxy forwards it (`X-Forwarded-For`) and Uvicorn runs with `--proxy-headers`.

## Health check — `GET /health`

Returns `{"status":"ok","database":true}` (`200`) when the database is reachable, `503` otherwise — poll it from a supervisor or uptime monitor. The same check runs once at startup and the process refuses to boot on failure.

## Logging

Standard-library `logging`: stdout plus a rotating file (`backend/logs/panicbutton.log`, 5 MB × 3, gitignored). `LOG_LEVEL` sets the minimum severity. Every line carries a short **request id** (assigned per request, inherited by background tasks) so one alert and its fan-out can be followed end to end. The `httpx` client logger is pinned to `WARNING` so bot tokens never land in the log.

Useful lines to grep:

- `Telegram webhook status: url=… last_error=…` — at startup, tells you if the Telegram webhook is registered (see [notifications.md](notifications.md)).
- `WhatsApp webhook: received inbound from …` / `opt-in confirmed for contacts …` — WhatsApp opt-in.
- `Twilio rejected SMS … [status=…]` — an SMS that Twilio refused (often a geo-permission or unverified-number issue).
- `Alert N: notifying X by email, Y by Telegram, Z by WhatsApp, W by SMS` — per-alert fan-out counts.

## Feature flags — `GET /features`

```json
{"telegram": true, "whatsapp": true, "sms": true, "max_contacts": 4}
```

Unauthenticated, cached by the app for its session. `max_contacts` is the emergency-contact cap, served so the app and backend can't drift.

## Migrations

`queries/tables.sql` is the full schema for fresh installs. To upgrade an existing database, apply the files in `queries/migrations/` **in date order, once each** (they are not idempotent):

```bash
mariadb -u <user> -p <DATABASE> < queries/migrations/2026-08-add-whatsapp.sql
mariadb -u <user> -p <DATABASE> < queries/migrations/2026-08-add-sms.sql
mariadb -u <user> -p <DATABASE> < queries/migrations/2026-08-dashboard-history.sql
mariadb -u <user> -p <DATABASE> < queries/migrations/2026-09-realtime-geolocation.sql
mariadb -u <user> -p <DATABASE> < queries/migrations/2026-09-drive-only-video.sql
```

- **add-whatsapp** — WhatsApp columns + `whatsapp` in the `channel` enum.
- **add-sms** — SMS column + `sms` in the `channel` enum.
- **dashboard-history** — `alert_notifications.contact_name` + makes `contact_id` `ON DELETE SET NULL` (so deleting a contact no longer wipes the alert's history). Backfills existing names.
- **realtime-geolocation** — alert lifecycle/latest-position columns plus the ordered `alert_locations` trail table.

Confirm a migration landed, e.g.: `SHOW COLUMNS FROM alert_notifications LIKE 'contact_name';`.

## Maintenance script

```bash
uv run scripts/purge_unconfirmed_users.py
```

Deletes accounts still unconfirmed 24 h after signup. Safe by construction (login is blocked pre-confirmation, so such accounts own nothing). Run it periodically from cron; it is not wired into the API.
