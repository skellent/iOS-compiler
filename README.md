# Panic Button

A panic button emergency call: hold the button in the mobile app, and your emergency contacts receive an email, Telegram, WhatsApp, or SMS link that follows your location in real time.

![badge](https://shieldcn.dev/badge/Python->=%203.12-abcde3.svg?size=default&logo=python)
![badge](https://shieldcn.dev/badge/MariaDB-abcde3.svg?size=default&theme=emerald&logo=mariadb&color=08933b)
![badge](https://shieldcn.dev/badge/Debian-abcde3.svg?size=default&logo=debian&logoColor=fdfeff&color=ef4444)
![badge](https://shieldcn.dev/badge/JavaScript-abcde3.svg?size=default&logo=javascript&logoColor=fdfeff&color=efcf44)
![badge](https://shieldcn.dev/badge/Capacitor.js-Android%20&%20iOS-abcde3.svg?size=default&logo=ri%3AFaMobileAlt&logoColor=fdfeff&color=8b5cf6)

## Documentation

The design decisions behind every module — architecture diagrams, database schema, auth flow, notification flow — live in [`docs/`](docs), available in [English](docs/en/README.md) and [Spanish](docs/es/README.md). This README only covers getting the backend running; start there for how the system fits together.

# Backend Installation and Setup

## 1. Configure MariaDB

The MariaDB process must be initialized, and the corresponding user and database must be configured; the user and password will be defined by the server administrator, and those credentials must be written into a `.env` file inside the `backend` directory when it's set up — see `.envexample` to understand the required variables. This must be done as the `root` user, accessing the MariaDB console via `mariadb -u root`.

Also, the `./backend/queries` directory contains the SQL code to run to create the database tables, along with the aforementioned user and database creation, and includes examples of how the INSERTs work.

## 2. Prepare the Environment
- First, install Python (>=3.12) along with its corresponding version of pip
- Then, use the command `pip install uv` to install a more versatile package manager
- Once uv is installed, go to the `./backend` directory and run `uv sync`; the manager will automatically create a virtual environment and install the dependencies (if MariaDB isn't running at this step, a build error will pop up because of the mariadb library)
- Create a `.env` file in the `backend` directory and use `.envexample` as a template to fill in the credentials
- Run `uv run uvicorn main:app --reload`

> For testing, you can simply use `uv run main.py`

> If there's any issue with the server's Python version, uv can resolve it by telling it which version to install. Either way, the libraries/dependencies listed in `pyproject.toml` are compatible with Python 3.12 and up

### Expected `.env` structure

```env
USERNAME=''
PASSWORD=''
HOST=''
PORT=
DATABASE=''
JWT_SECRET_KEY=''
SMTP_USER=''
SMTP_PASSWORD=''
SMTP_HOST='smtp.gmail.com'
SMTP_PORT=587
SMTP_FROM=''
SMTP_ENABLED='true'
SMTP_VERIFY_DELIVERABILITY='true'
TELEGRAM_BOT_TOKEN=''
TELEGRAM_BOT_USERNAME=''
TELEGRAM_WEBHOOK_SECRET=''
API_BASE_URL='http://127.0.0.1:8000'
APP_MODE='Debug'
LOG_LEVEL='INFO'
```

`JWT_SECRET_KEY` is the key the backend uses to sign and verify the session tokens (JWT) issued by `POST /auth/login` — see [`docs/en/backend/auth.md`](docs/en/backend/auth.md) for the detail of how it's used. It isn't a MariaDB credential, so it doesn't come out of step 1's database setup: it has to be generated separately.

`SMTP_USER`/`SMTP_PASSWORD` are the Google Workspace account emails confirming emergency contacts are sent from, and `SMTP_PASSWORD` is specifically a 16-character **app password** (`myaccount.google.com/apppasswords`), not the account's real password — Google hasn't accepted basic SMTP authentication on Workspace accounts since March 2025. It requires 2-Step Verification active on that account and the Workspace administrator allowing app passwords to be created. See [`docs/en/backend/notifications.md`](docs/en/backend/notifications.md) for the full flow. `API_BASE_URL` is the public URL the API uses to build the confirmation link that travels in those emails — in production, the real domain behind whatever reverse proxy sits in front of the API.

`SMTP_FROM` is optional and defaults to `SMTP_USER` — it only needs to be set when the address emails should appear to come **from** isn't the same as the account SMTP authenticates **as**, which happens when that address lives on a domain alias rather than an independently-licensed account (for example, authenticating as `soporte@keycodelogics.com` while sending as `support@panicbutton.me`, if `panicbutton.me` is attached to the Workspace as a domain alias of the primary domain). `SMTP_USER`/`SMTP_PASSWORD` keep authenticating exactly as before either way — this only changes the `From:` header. The Workspace side (making the desired address an alias *of the authenticating account*, not just of the domain) has to be configured correctly first, or Gmail silently reverts `From:` back to `SMTP_USER`.

`SMTP_ENABLED` and `SMTP_VERIFY_DELIVERABILITY` both default to `true` and production leaves them there. Set `SMTP_ENABLED='false'` in local development to log outgoing mail instead of sending it (useful when pointing at a real SMTP account), and `SMTP_VERIFY_DELIVERABILITY='false'` to skip the recipient-domain check when working offline where DNS isn't available. See [`docs/en/backend/operations.md`](docs/en/backend/operations.md).

`TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME` come from a bot registered with Telegram's own **@BotFather** (see the step-by-step below); `TELEGRAM_WEBHOOK_SECRET`, like `JWT_SECRET_KEY`, isn't issued by anyone — it's a random string this deployment makes up and registers with Telegram, used to verify that a call to `POST /telegram/webhook` genuinely came from Telegram and not from anyone who found the URL. All three are optional: without a `TELEGRAM_BOT_TOKEN`, the backend boots normally and simply never registers a webhook or sends Telegram messages — see [`docs/en/backend/notifications.md`](docs/en/backend/notifications.md) for the full flow.

#### `APP_MODE`: toggling FastAPI's automatic docs

`APP_MODE` controls whether the API exposes its automatic documentation — `/docs` (Swagger UI), `/redoc` (ReDoc) and `/openapi.json` (the raw OpenAPI schema). It accepts one of two values:

- **`Debug`** (the default — same behavior as if `APP_MODE` isn't set at all): the docs are enabled at their usual paths. Use this in local development.
- **`Deploy`**: the docs are fully disabled — the routes aren't just hidden, they stop being registered, so hitting them returns `404`. Use this in production, so the API's full surface (every endpoint, every field it expects) isn't handed out to anyone who can reach it without a token.

See [`docs/en/backend/architecture.md`](docs/en/backend/architecture.md) for the implementation detail.

#### `LOG_LEVEL`: how much gets logged

`LOG_LEVEL` sets the minimum severity written to both the console and `backend/logs/panicbutton.log` (a rotating file, gitignored) — one of Python's standard `logging` level names (`DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`). Defaults to `INFO` if unset or misspelled. See [`docs/en/backend/operations.md`](docs/en/backend/operations.md) for what gets logged at each level.

#### Generate `JWT_SECRET_KEY` for production

It has to be a long, random string, not a hand-picked phrase — anyone who knows it can sign valid tokens for any user of the system. To generate one on the machine where the backend will be deployed, with `uv` already installed and `uv sync` already run (step 2), this is enough:

```bash
uv run python -c "import secrets; print(secrets.token_hex(32))"
```

This prints a 64-character hex string (256 bits of entropy) that gets pasted as-is as the value of `JWT_SECRET_KEY` in that environment's `.env`. Each environment (development, production, etc.) should have its own separately generated secret — don't reuse the same value across them, and never commit it (that's why `.env` is in `.gitignore`).

#### Get `SMTP_PASSWORD` (Google Workspace app password)

Outgoing email authenticates with an **app password** for a Google Workspace account, not the account's real password — Google hasn't accepted basic SMTP authentication (username + normal password) on Workspace accounts since March 2025. Steps to get one:

1. **Enable 2-Step Verification on the account.** Go to [`myaccount.google.com/security`](https://myaccount.google.com/security) with the Workspace account that will send mail and turn on "2-Step Verification" if it isn't already. This is a hard requirement: without 2FA on, Google won't even show the app passwords option.
2. **Confirm the Workspace administrator allows app passwords.** This is controlled at the organization level, not the individual account level, so it can be blocked even if step 1 is done. The Workspace administrator has to go to [Admin Console](https://admin.google.com) → **Security** → **Authentication** → **2-Step Verification**, and enable "Allow users to create app passwords" there. If this policy is disabled, ask the administrator to enable it, or authenticate a different way (e.g. OAuth2/service account) if the organization prefers not to enable app passwords.
3. **Generate the password.** With the account already logged in and 2FA on, go to [`myaccount.google.com/apppasswords`](https://myaccount.google.com/apppasswords), give it a recognizable name (for example, "PanicButton Backend") and generate it. Google shows a 16-character password grouped into 4 blocks of 4 (for example `abcd efgh ijkl mnop`) — use it **without the spaces**.
4. **Fill in the `.env`.** `SMTP_USER` is the account's full email and `SMTP_PASSWORD` is the 16-character password generated in the previous step (no spaces). `SMTP_HOST`/`SMTP_PORT` already come with the correct default value (`smtp.gmail.com`/`587`) and shouldn't need changes.

This password can be revoked at any time from the same `apppasswords` page without affecting the account's real password — it's worth generating a different one per environment (development, production) so one can be revoked without affecting the other, same as with `JWT_SECRET_KEY`.

#### Get the Telegram bot credentials (BotFather)

Panic alerts can also reach a contact over Telegram, in parallel to email (see [`docs/en/backend/notifications.md`](docs/en/backend/notifications.md) for the full flow). This requires a bot, created through Telegram's own **@BotFather** — there's no dashboard or web console for this, it's all done by chatting with BotFather itself:

1. **Open a chat with BotFather.** In Telegram (any device), search for `@BotFather` and start a chat — it's the official bot Telegram itself provides for managing other bots, verified with a blue checkmark.
2. **Create the bot.** Send `/newbot`. BotFather will ask for:
   - A **display name** (e.g. "Panic Button"), shown to contacts in their chat list — can be changed later, doesn't need to be unique.
   - A **username**, which does have to be unique across all of Telegram and must end in `bot` (e.g. `PanicButtonBot` or `panic_button_bot`). This is what goes into `TELEGRAM_BOT_USERNAME` — **without** the leading `@`.
3. **Copy the token.** Once created, BotFather replies with a message containing a line like:
   ```
   Use this token to access the HTTP API:
   123456789:AAHk3jz9X7q_examplecharactersgoeshereXYZ
   ```
   That whole string (digits, colon, and the rest) is `TELEGRAM_BOT_TOKEN`. Treat it exactly like a password — anyone who has it can send messages as the bot and read its incoming updates. If it ever leaks, message BotFather with `/revoke` (or `/token` to reissue) to invalidate it and get a new one.
4. **Generate `TELEGRAM_WEBHOOK_SECRET` yourself.** This one doesn't come from BotFather — it's an arbitrary string this deployment invents and registers with Telegram (`Telegram.SetWebhook`, called automatically at startup, see [`docs/en/backend/notifications.md`](docs/en/backend/notifications.md)), the same idea and the same command as generating `JWT_SECRET_KEY` above:
   ```bash
   uv run python -c "import secrets; print(secrets.token_hex(32))"
   ```
5. **Fill in the `.env`.** `TELEGRAM_BOT_TOKEN` from step 3, `TELEGRAM_BOT_USERNAME` from step 2 (no `@`), `TELEGRAM_WEBHOOK_SECRET` from step 4.

No further configuration is needed on Telegram's side — the backend registers itself as the bot's webhook the moment it starts up (as long as `API_BASE_URL` is a real, publicly reachable HTTPS URL; Telegram can't call back to `http://127.0.0.1:8000`, so this step is effectively a no-op in local development and only takes effect once deployed behind a real domain). Optional but recommended: message BotFather with `/setdescription` and `/setuserpic` to give the bot a recognizable description and avatar, since that's what a contact sees the moment they open the deep-linked chat for the first time.

# Using the API

With the server running, the API exposes registration and login routes (`/auth`), management of the authenticated user (`/users/me`), emergency contacts (`/contacts`, including linking a contact's Telegram account under `/contacts/{id}/telegram`), and triggering panic alerts (`/alerts`, which notifies confirmed contacts by email and/or Telegram — see [`docs/en/backend/notifications.md`](docs/en/backend/notifications.md)). The complete guide to each endpoint, with usage examples in Python and JavaScript, is in [`backend/API.md`](backend/API.md); a quick reference table is in [`docs/en/backend/api.md`](docs/en/backend/api.md). The design decisions behind each backend module (why JWT, why that route structure, etc.) are documented in [`docs/en/backend/`](docs/en/backend/) ([Spanish](docs/es/backend/)).

# App Preparation and Build

The mobile client lives in [`app/`](app), built with [Capacitor](https://capacitorjs.com/) and plain HTML/CSS/JavaScript (no frontend framework) — Android and iOS from the same codebase. It's a client of the backend above: registration, login, the panic button (captures GPS and hits `POST /alerts`), and managing emergency contacts (including picking them straight from the phone's address book). See [`app/README.md`](app/README.md) for setup instructions and [`docs/en/app/`](docs/en/app) ([Spanish](docs/es/app/)) for the design decisions behind how it's built.

The app's own UI isn't bundled into the native binary anymore — the WebView navigates straight to this backend's `/app` route and loads it live (see [`docs/en/app/architecture.md`](docs/en/app/architecture.md)'s "Why the app loads its UI from the backend"), the same idea as Electron pointing a window at a URL. That means **the backend needs `app/www` built before it can serve the app at all**: run `bun run build` inside `app/` (step 3 of `app/README.md`) before starting the backend, or after any change under `app/src/`. The app checks a content-hash manifest at `/app/manifest` on launch and when resuming from the background, and reloads itself automatically when it detects the backend's files changed — no separate "push an update" step needed beyond redeploying the backend with a fresh `app/www`. **A native-level change (a new Capacitor plugin, a manifest permission) is the one exception** — that needs a new APK build, not just a fresh `app/www` (see [`docs/en/app/architecture.md`](docs/en/app/architecture.md)).

# History

Full commit-by-commit history is in `git log` — this README used to embed a hand-maintained Mermaid `gitGraph` of it, which reliably went stale faster than anyone remembered to update it. In short: the backend (FastAPI + MariaDB) came first, then JWT auth and contacts/alerts CRUD, then email notifications, then the Capacitor mobile app, then Telegram as a second notification channel alongside email, then the app-online architecture (the app loading its UI live from the backend instead of bundling it) and this documentation rewrite.
