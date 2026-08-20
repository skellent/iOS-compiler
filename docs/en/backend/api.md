# API reference

Quick reference for every route. 🔒 = requires `Authorization: Bearer <token>` (see [auth.md](auth.md)). Full request/response bodies and code examples live in [`backend/API.md`](../../../backend/API.md).

## `/auth`

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /auth/register` | — | Create a user, email an account-confirmation link. Rate-limited; the email domain is deliverability-checked. |
| `POST /auth/login` | — | Verify credentials + `confirmed`, return a JWT. Rate-limited. |
| `GET /auth/confirm/{token}` | — | Confirm an account from the email link (HTML page). |

## `/users`

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /users/me` | 🔒 | Current user's profile. |
| `PUT /users/me` | 🔒 | Partial update (name/phone/email/password) — changing email or password also requires `current_password` (see [auth.md](auth.md)). |

## `/contacts`

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /contacts` | 🔒 | Add an emergency contact (max 4), email a confirmation link if it has an email. |
| `GET /contacts` | 🔒 | List contacts with `confirmed`, `telegram_linked`, `whatsapp_enabled`, `whatsapp_confirmed`, `sms_enabled`. |
| `GET /contacts/confirm/{token}` | — | Confirm a contact's email from the link (HTML page). |
| `PUT /contacts/{id}` | 🔒 | Partial update — changing the email resets confirmation and re-sends it. |
| `POST /contacts/{id}/confirm/resend` | 🔒 | Re-send the email confirmation to an unconfirmed contact. Rate-limited. |
| `DELETE /contacts/{id}` | 🔒 | Delete a contact. Past alerts keep its name (see [database.md](database.md)). |
| `POST /contacts/{id}/telegram/enable` | 🔒 | Start a Telegram link (returns a `t.me` link or emails it). |
| `DELETE /contacts/{id}/telegram` | 🔒 | Unlink Telegram. |
| `POST /contacts/{id}/whatsapp/enable` | 🔒 | Enable WhatsApp; returns a `wa.me` opt-in link. |
| `DELETE /contacts/{id}/whatsapp` | 🔒 | Disable WhatsApp (clears enabled + confirmed). |
| `POST /contacts/{id}/sms/enable` | 🔒 | Enable SMS for the contact. |
| `DELETE /contacts/{id}/sms` | 🔒 | Disable SMS. |

## `/alerts`

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /alerts` | 🔒 | Trigger a panic alert; notifies each confirmed contact on every active channel. Rate-limited. Returns per-channel counts. |
| `GET /alerts` | 🔒 | List alerts, each with its notifications (`contact_name`, `channel`, `viewed_at`, `contact_removed`). |
| `GET /alerts/view/{token}` | — | Map link sent to a contact — marks it seen and redirects to Google Maps. |

`POST /alerts` response:

```json
{
  "id": 42,
  "created_at": "2026-08-20T15:28:33",
  "notified_contacts": 3,
  "channels": { "email": 2, "telegram": 1, "whatsapp": 1, "sms": 0 }
}
```

## Webhooks

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /telegram/webhook` | webhook secret | Telegram calls this on each bot update. |
| `POST /whatsapp/webhook` | Twilio signature | Twilio calls this on inbound WhatsApp messages (opt-in). |

## `/features` and service routes

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /features` | — | `{"telegram": bool, "whatsapp": bool, "sms": bool, "max_contacts": int}`. |
| `GET /health` | — | Service + database reachability (`200` / `503`). |
| `GET /favicon.ico` | — | Site favicon. |
| `GET /` | — | Landing page. |
| `GET /dashboard` | — | Alert dashboard (logs in with an app account). |

Registration, login, resend, and alert are rate-limited; over the limit returns `429`. See [operations.md](operations.md). Static assets are served at `/static`, and the mobile UI at `/app` (see [web-pages.md](web-pages.md) and [app/architecture.md](../app/architecture.md)).
