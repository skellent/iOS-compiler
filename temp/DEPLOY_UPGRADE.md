# Deploying the `security-fixes` branch to the backend

A runbook for upgrading the **already-running** production backend to this branch.
Read the whole thing once before starting — a few behaviours change in ways worth
knowing in advance.

Commits in this upgrade (oldest first):

```
6a4be03  Backend security & stability fixes
b36a3a7  Special-case handling: contact re-confirmation, email verification, re-auth, panic guard
3d56651  Follow-ups: resend contact confirmation + security-change notifications
```

---

## The one-minute summary

- **No database migration.** Nothing in this branch adds or alters a column. It uses
  only existing tables plus a `SELECT ... FOR UPDATE` row lock. You do **not** touch
  the schema.
- **Two new Python dependencies** (`slowapi`, `email-validator`) — a `uv sync` away.
- **Everyone gets logged out once.** Session tokens changed shape; old ones stop
  validating. Users simply log in again. Nothing is lost.
- **The mobile app updates itself** — this includes `app/www` changes, which reach
  devices through the normal `/app/manifest` reload. **No new APK.**
- Three config items you must confirm before restarting (below).

---

## Before you deploy — the checklist

1. **Rotate `JWT_SECRET_KEY` to a strong value (do this now regardless).**
   The current key is only 19 bytes. Generate a real one on the server:
   ```bash
   uv run python -c "import secrets; print(secrets.token_hex(32))"
   ```
   Paste it into `backend/.env`. This also, deliberately, invalidates every existing
   session — which you're doing anyway (see below), so now is the moment.

2. **Set `TELEGRAM_WEBHOOK_SECRET` if the bot is configured.**
   This branch **refuses to register a webhook without a secret** (previously it
   registered an unauthenticated one). If production has `TELEGRAM_BOT_TOKEN` set but
   no `TELEGRAM_WEBHOOK_SECRET`, Telegram will stop reaching the webhook until you set
   one. Generate it the same way as the JWT key, put it in `.env`, and it re-registers
   on the next start.

3. **Confirm nginx forwards the real client IP.**
   Rate limiting is now active and keys off the client address. If nginx doesn't pass
   it through, every request looks like it comes from nginx and all users share one
   bucket. Ensure the proxy sets the header:
   ```nginx
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Real-IP $remote_addr;
   ```
   and start uvicorn with `--proxy-headers --forwarded-allow-ips="127.0.0.1"` (adjust
   the trusted proxy IP to your setup).

4. **Leave the new mail vars at their defaults in production.**
   `SMTP_ENABLED` and `SMTP_VERIFY_DELIVERABILITY` both default to `true` when unset —
   which is what production wants. Do **not** set `SMTP_ENABLED=false` in prod (that
   turns real email off). The server also now needs **outbound DNS** so the
   deliverability check can look up recipient domains — it almost certainly already
   has it, but note it if egress is locked down.

5. **Rotate the Telegram bot token.**
   Older builds logged the full Telegram API URL — which contains the bot token — into
   `backend/logs/panicbutton.log`. That token is sitting in current and rotated log
   files. This branch stops the leak, but the already-leaked token should be revoked
   via BotFather `/revoke`, the new one placed in `.env`, and the old log files cleared.

---

## The deploy

Assuming the usual layout (a systemd service running uvicorn, code under a git
checkout). Adjust names to your host.

```bash
# 1. Get the code
cd /path/to/panicbutton.me
git fetch origin
git checkout security-fixes         # or merge it into main first, see below
git pull

# 2. Install the two new dependencies
#    (uv.lock is gitignored here, so uv resolves fresh against pyproject.toml)
cd backend
uv sync

# 3. Apply the .env changes from the checklist above (JWT key, webhook secret, etc.)
#    nano .env

# 4. Restart the service
sudo systemctl restart panicbutton      # whatever your unit is called

# 5. Watch it come up
sudo systemctl status panicbutton
tail -n 40 logs/panicbutton.log
```

On a healthy start the log shows:

```
Starting Panic Button API (app_mode=Deploy)
Database connection verified
Telegram webhook registered at https://.../telegram/webhook   # only if configured
Application startup complete.
```

Note **"Database connection verified"** — startup now checks the database and the
process **refuses to boot if it can't reach it**, instead of failing later on the
first query. If the service won't start, that line (or its absence) tells you why.

---

## Verify it's live

```bash
# Health endpoint (new) — returns 200 + {"status":"ok","database":true}
curl -s https://YOUR_DOMAIN/health

# Rate limiting is active — the 11th rapid login returns 429
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code} " \
    -X POST https://YOUR_DOMAIN/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"nobody@example.com","password":"x"}'
done; echo
# expect: ... 401 401 429
```

Then, from a phone or the dashboard, log in (you'll have to — see below) and confirm
normal use.

---

## What changes for users and operators

- **All sessions are invalidated once.** Tokens now carry a `type` claim and the auth
  check enforces it; tokens issued before this deploy (and any signed with the old JWT
  key) no longer validate. Every user logs in again on next use. No data is affected.
- **The mobile app reloads itself.** `app/www/js/main.js` is rebuilt in this branch;
  once the new backend serves it, devices pick it up via the launch/resume manifest
  check. The app gains: the re-auth prompt for email/password changes, the "resend
  confirmation" button, and the panic-button "no confirmed contacts" guard. **No APK
  rebuild** — nothing native changed.
- **Registration and contact emails can now be rejected** with a 422 if the address's
  domain can't receive mail. This is intended; it stops accounts that could never be
  confirmed.
- **Changing email or password now requires the current password**, and sends a
  security notice to the previous email address.
- **Old alert-view links still work.** Links already mailed to contacts keep
  functioning; only newly issued ones carry the 30-day expiry.

---

## Rolling back

Because there's no schema change, rollback is just checking out the previous commit
and restarting — the old code runs against the same database unchanged:

```bash
cd /path/to/panicbutton.me
git checkout <previous-commit-or-main>
cd backend && uv sync          # restores the previous dependency set
sudo systemctl restart panicbutton
```

The only lingering effect is that users log in again (twice, if you roll back after
they'd re-logged in on the new build). If you rotated `JWT_SECRET_KEY`, keep the new
value on rollback — the old code reads it fine, and reverting the secret would just
invalidate sessions a third time.

---

## Merging to main first (recommended)

The repository deploys from a checkout; decide whether production tracks `main` or a
release branch. If it tracks `main`, merge this branch there before deploying so the
deployed ref and the source of truth match:

```bash
git checkout main
git merge --no-ff security-fixes
git push origin main
```

Then run the deploy steps above against `main`. (This branch is three commits ahead of
`main` with no divergence, so the merge is clean.)
