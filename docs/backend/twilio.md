# Twilio setup — WhatsApp & SMS

Both the WhatsApp and SMS channels go through **Twilio**. They share `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` (from the Twilio Console dashboard) and each adds its own sender.

- **SMS** is simple: buy a number, set `TWILIO_SMS_FROM`, done.
- **WhatsApp** is stricter: WhatsApp only allows free-form text within 24 h of the *contact* messaging you. A panic alert almost always happens outside that window, so it must be sent through an **approved template**. That means a real WhatsApp sender **and** an approved template.

---

## SMS

1. In the Twilio Console, buy a phone number with **SMS** capability (*Phone Numbers → Buy a number*).
2. Set it in `.env` (E.164, no spaces/parentheses):
   ```bash
   TWILIO_SMS_FROM='+15102964314'
   TWILIO_SMS_ENABLED='true'
   ```
3. Restart, enable **SMS** on a contact in the app, trigger an alert.

There is no opt-in, template or 24 h window for SMS. Two things to know:

- **US/Canada numbers** require **A2P 10DLC** registration (or a verified **toll-free** number) before carriers deliver automated SMS reliably. Buying the number does **not** register it — do it in *Messaging → Regulatory Compliance*. A non-US number usually needs none of this.
- **International destinations are geo-restricted.** Sending to a country Twilio has disabled returns error **21408**; enable the region in *Messaging → Settings → Geo Permissions*. Even then, delivery to some countries is unreliable — prefer Telegram/WhatsApp for contacts abroad.

---

## WhatsApp

### Step 1 — a WhatsApp Sender

The number must appear as an approved **WhatsApp Sender** in Twilio (*Messaging → Senders → WhatsApp senders*). If it was approved in Meta but isn't linked to Twilio yet, create the sender there and connect the Meta Business Account (WABA) through the embedded signup. Prerequisites: a paid Twilio account, a Meta Business Manager, and a phone number **not** currently in the WhatsApp app.

The **sandbox** (`whatsapp:+14155238886`) is fine for wiring tests but cannot use custom templates — production needs a real sender.

### Step 2 — the alert template

*Messaging → Content Template Builder → Create*:

- Type **Text**, category **Utility**, language **`en`** (the template text is English).
- Body, with three variables **in this exact order**:

  > 🚨 {{1}} triggered a panic alert on {{2}}. Location: {{3}}

- Submit for WhatsApp approval, wait for **Approved**, copy the `HX…` id.

The backend fills the variables from a fixed contract — do not change the count or order:

| Variable | Filled with |
|---|---|
| `{{1}}` | the user's name |
| `{{2}}` | date & time (`MM/DD/YYYY HH:MM:SS`) |
| `{{3}}` | the token-protected live location link |

### Step 3 — the inbound webhook (opt-in)

Unlike Telegram, the WhatsApp webhook is **not** auto-registered — set it by hand on the sender (or its Messaging Service), field **"When a message comes in"**:

```
https://YOUR-DOMAIN/whatsapp/webhook     (POST)
```

This is how a contact's opt-in reaches the backend. It must match `API_BASE_URL` + `/whatsapp/webhook` exactly, because `TWILIO_VALIDATE_SIGNATURE=true` checks Twilio's signature against that URL.

### Step 4 — configure and test

```bash
TWILIO_ACCOUNT_SID='AC...'
TWILIO_AUTH_TOKEN='...'
TWILIO_WHATSAPP_FROM='whatsapp:+<your number>'
TWILIO_WHATSAPP_TEMPLATE_SID='HX...'
TWILIO_WHATSAPP_JOIN_KEYWORD=''          # sandbox only; leave empty in production
TWILIO_WHATSAPP_ENABLED='true'
TWILIO_VALIDATE_SIGNATURE='true'
```

Then:

1. Enable **WhatsApp** on a contact in the app — it returns a `wa.me` link.
2. The contact opens the link and **sends** the message. The webhook confirms them (`whatsapp_confirmed`); the log shows `WhatsApp opt-in confirmed for contacts […]`.
3. Trigger an alert — it is delivered through the template, regardless of the 24 h window.

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `21654 / 63016 "ContentSid required"` | Alert sent as free-form outside the 24 h window. Set `TWILIO_WHATSAPP_TEMPLATE_SID` to an approved template. |
| No webhook log at all | "When a message comes in" not configured (or on the wrong sender). |
| `received inbound … no whatsapp-enabled contact matches …` | The contact wrote from a different number than the stored `phone`, or WhatsApp isn't enabled for them. |
| `/features` shows `"whatsapp": false` | One of `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` is missing. |
| Webhook returns `403` | Registered URL ≠ `API_BASE_URL` + `/whatsapp/webhook`, or not HTTPS. |
