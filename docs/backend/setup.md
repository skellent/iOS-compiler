# Setup & first run

This walks a fresh machine from nothing to a running backend.

## Prerequisites

- **Python 3.12+**
- **[uv](https://docs.astral.sh/uv/)** — the package manager/runner used throughout (`uv run …`).
- **MariaDB 10.6+** (or a compatible MySQL) reachable from the backend.
- For building the mobile app only: **[Bun](https://bun.sh/)** and the Android SDK.

## 1. Get the code and dependencies

```bash
git clone <repo-url> panicbutton.me
cd panicbutton.me/backend
uv sync            # installs backend dependencies into a local .venv
```

## 2. Provision the database

Create the database and a user, then create the tables. The SQL lives in `backend/queries/`.

```bash
mariadb -u root -p
```

```sql
-- from queries/creation.sql — adjust the placeholders
CREATE DATABASE panicbutton CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'panic'@'localhost' IDENTIFIED BY 'a-strong-password';
GRANT ALL PRIVILEGES ON panicbutton.* TO 'panic'@'localhost';
FLUSH PRIVILEGES;
```

Then load the schema:

```bash
mariadb -u panic -p panicbutton < queries/tables.sql
```

`queries/tables.sql` is the source of truth for a fresh install — it already includes every column (all four channels, the denormalised `alert_notifications.contact_name`, etc.). The files in `queries/migrations/` are only for upgrading an **existing** database; a fresh `tables.sql` install needs none of them.

## 3. Configure `.env`

Copy the example and fill it in:

```bash
cp .envexample .env
```

The minimum to boot is the database block and a JWT secret. Every variable is documented in [operations.md](operations.md); the essentials:

```bash
USERNAME='panic'
PASSWORD='a-strong-password'
HOST='127.0.0.1'
PORT=3306
DATABASE='panicbutton'

JWT_SECRET_KEY='<32+ random bytes, see below>'

API_BASE_URL='http://127.0.0.1:8000'
APP_MODE='Debug'
```

Generate the JWT secret (never reuse it across environments, never commit `.env`):

```bash
uv run python -c "import secrets; print(secrets.token_hex(32))"
```

Email, Telegram, WhatsApp and SMS are all **optional** — leave their variables blank to run without them. To develop against a real SMTP account without sending mail, set `SMTP_ENABLED='false'` (dry-run: it logs instead of sending). The Twilio channels have the same switch (`TWILIO_WHATSAPP_ENABLED`, `TWILIO_SMS_ENABLED`).

> **Windows note:** the OS defines its own `USERNAME` variable. `.env` is loaded with `override=True` specifically so the MariaDB `USERNAME` wins over the Windows account name.

## 4. Run it

```bash
uv run uvicorn main:app --host 127.0.0.1 --port 8000
```

At startup the backend verifies the database connection (and refuses to boot if it can't reach it) and, if a Telegram bot is configured, registers its webhook. Check it's alive:

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok","database":true}
```

- API docs (Swagger) are at `/docs` unless `APP_MODE='Deploy'`.
- The landing page is at `/`, the alert dashboard at `/dashboard`.

## 5. Behind a reverse proxy (production)

Run Uvicorn with proxy headers so client IPs (used by the rate limiter) and HTTPS are seen correctly:

```bash
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips='*'
```

Terminate TLS at nginx and forward to the backend. `API_BASE_URL` must be the public **HTTPS** URL (Telegram and the confirmation/opt-in links depend on it — see [domain-change.md](domain-change.md)). A sensible hardening rule is to deny access to dotfiles:

```nginx
location ~ /\.(?!well-known) { deny all; return 404; }
```

SOS video uploads also require request streaming so Nginx does not write the recording to a temporary file. Add the dedicated `proxy_request_buffering off` location from [the SOS video setup guide](../../backend/docs/sos-video-setup.md) before the general proxy location.

## 6. Build the mobile app (optional)

The app loads its UI from the backend, but the JS bundle is built with Bun:

```bash
cd ../app
bun install
API_BASE_URL='https://your-domain' bun run build   # outputs www/js/main.js
```

See [app/architecture.md](../app/architecture.md) for the online-app model and when an APK rebuild is actually required.

## Next steps

- [Twilio setup](twilio.md) to turn on WhatsApp and SMS.
- [Operations](operations.md) for the full environment-variable reference, logging and the maintenance script.
