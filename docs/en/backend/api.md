# API reference

Quick reference for every route. Full request/response bodies and Python/JavaScript usage examples live in [`backend/API.md`](../../../backend/API.md) — this page is the map, that one is the detail. 🔒 = requires `Authorization: Bearer <token>` (see [`auth.md`](auth.md)).

## `/auth`

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /auth/register` | — | Create a user, email an account-confirmation link |
| `POST /auth/login` | — | Verify credentials + `confirmed`, return a JWT |
| `GET /auth/confirm/{token}` | — | Confirm an account from the emailed link (HTML page) |

## `/users`

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /users/me` | 🔒 | Current user's profile |
| `PUT /users/me` | 🔒 | Partial update (name/phone/email/password) |

## `/contacts`

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /contacts` | 🔒 | Add an emergency contact (max 4), emails a confirmation link if it has an email |
| `GET /contacts` | 🔒 | List the current user's contacts, with `confirmed`/`telegram_linked` flags |
| `GET /contacts/confirm/{token}` | — | Confirm a contact from the emailed link (HTML page) |
| `PUT /contacts/{id}` | 🔒 | Partial update |
| `DELETE /contacts/{id}` | 🔒 | Remove a contact |
| `POST /contacts/{id}/telegram/enable` | 🔒 | Start a Telegram link (see [`notifications.md`](notifications.md)) |
| `DELETE /contacts/{id}/telegram` | 🔒 | Unlink Telegram from a contact |

## `/alerts`

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /alerts` | 🔒 | Trigger a panic alert — notifies every confirmed contact by email and/or Telegram |
| `GET /alerts` | 🔒 | List the current user's alerts, each with per-contact/channel delivery status |
| `GET /alerts/view/{token}` | — | A contact's emailed/Telegram map link — marks it viewed, then redirects to Google Maps |

## `/telegram`

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /telegram/webhook` | webhook secret | Telegram calls this on every bot update; not meant to be called directly |

## `/features`

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /features` | — | `{"telegram": bool}` — whether this deployment has a Telegram bot configured |

## Web pages (not JSON)

See [`web-pages.md`](web-pages.md) for `GET /`, `GET /dashboard`, and the `/app`/`/static` static mounts.
