# Notifications: email + Telegram

Two independent, parallel delivery channels for the same events (contact confirmation, panic alerts): `mail.py` (`Mail`) and `telegram.py` (`Telegram`). Neither knows about the other — routers decide who gets notified on which channel(s) and call both.

## `Mail`

SMTP over `aiosmtplib`, Jinja templates under `templates/mail/*.{html,txt}.j2` (both rendered — HTML with a plain-text fallback in the same message). `Mail.Send` opens one connection per email; `Mail.SendBulk` opens a single SMTP connection and reuses it for every recipient, since a panic alert may fan out to several contacts at once.

```python
await Mail.SendBulk(subject, template, [(email, context), ...])
```

A failure for one recipient inside `SendBulk` is logged and collected, not raised immediately — only after the whole batch does it raise `MailNotSentError` listing who failed, so one bad address doesn't stop the rest from being sent.

## `Telegram`

HTTP calls to the Telegram Bot API (`httpx`), templates under `templates/telegram/*.txt.j2` (plain text only — Telegram has no HTML-email equivalent). Same `Send`/`SendBulk` shape as `Mail`, plus `SetWebhook` (called once at startup, see [`architecture.md`](architecture.md)).

## Why `alerts.py` treats a mail failure as non-fatal

```python
async def _notify_by_mail(subject, template, recipients):
    try:
        await Mail.SendBulk(subject, template, recipients)
    except MailNotSentError:
        pass  # already logged inside SendBulk
```

`BackgroundTasks` runs its queued tasks in order and stops at the first exception. `create_alert` queues the email batch and the Telegram batch as two separate background tasks — if the email task's exception were allowed to propagate, the Telegram task queued right after it would never run. During an actual panic alert, a broken mailbox must never be the reason a contact who only has Telegram never hears about it.

## Panic alert fan-out

```mermaid
sequenceDiagram
    participant App
    participant Alerts as POST /alerts
    participant DB
    participant Mail
    participant TG as Telegram

    App->>Alerts: latitude, longitude + JWT
    Alerts->>DB: INSERT INTO alerts
    Alerts->>DB: SELECT confirmed contacts (email OR telegram_chat_id)
    loop each contact
        Alerts->>DB: INSERT alert_notifications (one row per channel)
    end
    Alerts-->>App: 201 (immediately)
    par background
        Alerts->>Mail: SendBulk(panic_alert, email recipients)
        Mail-->>Alerts: (each recipient's link marked unviewed)
    and background
        Alerts->>TG: SendBulk(panic_alert, telegram recipients)
    end
```

A contact needs *either* `confirmed = TRUE` (email) or a set `telegram_chat_id` — the two channels are independent, not sequential; someone who never clicked the email confirmation link but did link Telegram still gets notified. Each `(alert, contact, channel)` gets its own `alert_notifications` row and its own no-expiry view-link token (see [`auth.md`](auth.md)), so "did this specific contact, on this specific channel, open the map" is tracked separately — visible on the dashboard.

## Contact confirmation (email)

```mermaid
sequenceDiagram
    participant User
    participant API as POST /contacts
    participant Mail
    participant Contact
    participant Confirm as GET /contacts/confirm/:token

    User->>API: add contact (with email)
    API->>Mail: send contact_confirmation (background task)
    Mail-->>Contact: email with confirmation link
    Contact->>Confirm: clicks link
    Confirm->>Confirm: Token.ValidateContactConfirmation
    Confirm-->>Contact: styled HTML result page
```

A contact added *without* an email skips this step entirely — it only becomes eligible for alerts via Telegram instead.

## Telegram linking

Telegram's own deep-link `start` parameter only allows `[A-Za-z0-9_-]`, which a dot-separated JWT can't satisfy — so unlike every other confirmation flow, this one uses an opaque, database-backed token instead of a JWT.

```mermaid
sequenceDiagram
    participant User as App user
    participant API as POST /contacts/:id/telegram/enable
    participant DB
    participant Contact
    participant Bot as Telegram Bot
    participant Webhook as POST /telegram/webhook

    User->>API: enable Telegram for a contact
    API->>DB: UPDATE contacts SET telegram_link_token, telegram_link_expires_at
    API-->>User: link URL (emailed to the contact, or handed back to share manually)
    Contact->>Bot: opens t.me/BOT_USERNAME, start param = link token
    Bot->>Webhook: update - message text "/start TOKEN", chat id
    Webhook->>DB: look up contact by token (must not be expired)
    Webhook->>DB: UPDATE contacts SET telegram_chat_id, clear token
    Webhook-->>Bot: confirmation message to the contact
```

- If the contact already has an email on file, the link is emailed (`telegram_link` template) and the API response omits the URL (`{"telegram_link_url": null}`) — the app doesn't need to show it.
- If not, the API hands the URL straight back so the app can offer it via the OS share sheet.
- The link expires after 24h (`telegram.LINK_EXPIRATION`) and is single-use — a successful link clears `telegram_link_token` back to `NULL`.

### Webhook security

Telegram doesn't sign requests. `POST /telegram/webhook` instead checks the `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET` — a value this deployment invents and registers once via `Telegram.SetWebhook` at startup, not issued by Telegram itself. Any request without a matching header is rejected with `401` before the update is even parsed (skipped only when no secret is configured at all, i.e. local development without a real bot).

Any exception while handling a webhook update is caught and logged, and the endpoint still returns `{"ok": true}` — Telegram retries aggressively on anything but a `2xx` response, and a retry storm over something a retry won't fix is worse than one dropped update.
