# Changing the domain

The public URL appears in several places — confirmation links, the Telegram and WhatsApp webhooks, the app bundle. This is the full checklist when it changes (say from `old.example.com` to `new.example.com`).

The single source of truth in the backend is **`API_BASE_URL`**. Get that right and most things follow.

## 1. Backend `.env`

```bash
API_BASE_URL='https://new.example.com'
```

Must be the public **HTTPS** URL, no trailing slash. Restart the backend. This immediately fixes:

- account and contact **confirmation links** in emails,
- the **contact alert map links** (`/a/…`) and owner/history map links (`/alerts/view/…`),
- the **WhatsApp opt-in link** handed to the app,
- the landing/dashboard canonical URLs.

## 2. Telegram webhook — automatic

On restart the backend re-registers the Telegram webhook to `API_BASE_URL/telegram/webhook` and verifies it stuck (with retries). Nothing manual — just confirm the startup log:

```
Telegram webhook status: url=https://new.example.com/telegram/webhook last_error=none
```

If it shows the old URL or an error, the keeper task also re-asserts it periodically; a restart is the quickest fix.

## 3. WhatsApp webhook — manual

Twilio does **not** learn the new URL on its own. In the Twilio Console, on the WhatsApp Sender (or its Messaging Service), update **"When a message comes in"**:

```
https://new.example.com/whatsapp/webhook     (POST)
```

This must match `API_BASE_URL` + `/whatsapp/webhook` exactly, or signature validation rejects inbound opt-ins with `403`. (SMS has no inbound webhook, so nothing to change there.)

## 4. Reverse proxy / TLS

- Point nginx's `server_name` at the new domain and issue a TLS certificate for it.
- Keep running Uvicorn with `--proxy-headers` so the backend sees HTTPS and the real client IP.

## 5. The mobile app

The app loads its UI from the backend, and `API_BASE_URL` is **baked into the JS bundle at build time**. After a domain change, rebuild and redeploy the bundle:

```bash
cd app
API_BASE_URL='https://new.example.com' bun run build   # regenerates www/js/main.js
```

The backend serves `app/www` at `/app`, so redeploying the backend ships the new bundle; installed apps pick it up on next launch (the `/app/manifest` content hash triggers the reload). **A full APK rebuild is only needed** if the native shell's start URL itself changes — a pure server-domain move that keeps the same app is covered by rebuilding the bundle.

## Quick checklist

- [ ] `API_BASE_URL` updated, backend restarted
- [ ] Startup log shows the Telegram webhook on the new URL
- [ ] WhatsApp "When a message comes in" updated in Twilio
- [ ] nginx `server_name` + TLS cert for the new domain
- [ ] App bundle rebuilt with the new `API_BASE_URL` and redeployed
- [ ] Smoke test: register → confirm email link resolves; a contact's WhatsApp opt-in confirms; an alert's map link opens
