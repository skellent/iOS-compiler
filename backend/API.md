# PanicButton API — Usage guide

This document explains how to consume the API from an external client (in particular, the Capacitor mobile app, see `app/`), with equivalent examples in Python and JavaScript. To understand *why* the API is built the way it is (design decisions, security, internal structure), see [`docs/en/backend/`](../docs/en/backend/) ([Spanish](../docs/es/backend/)) — this file focuses only on *how to use it* from the outside.

## Before you start

In local development, the API runs on `http://127.0.0.1:8000` (or whatever host/port you pass to `uvicorn`, see the main README). Every example in this document assumes that base URL; in production you'd replace it with the real domain the backend is deployed to.

Every request that carries a body (`POST`, `PUT`) expects and returns **JSON** (`Content-Type: application/json`).

## General flow

```mermaid
sequenceDiagram
    participant App as App (Capacitor)
    participant API

    App->>API: POST /auth/register (name, phone, email, password)
    API-->>App: 201 Created

    App->>API: POST /auth/login (email, password)
    API-->>App: 200 OK { access_token, token_type }
    Note over App: store access_token

    App->>API: GET /users/me<br/>Authorization: Bearer access_token
    API-->>App: 200 OK { id, name, phone, email }

    App->>API: POST /contacts<br/>Authorization: Bearer access_token
    API-->>App: 201 Created
```

In short: **you register once**, **you log in** to get a token, and **you resend that token** on every request that needs to know who you are. The token isn't stored on the server (see `docs/en/backend/auth.md`) — whoever loses it has to log in again to get a new one, there's no "recover session" on the backend side.

## Authentication

### `POST /auth/register`

Creates a new account. Doesn't require authentication (obviously: the account doesn't exist yet).

**Request body:**

```json
{
  "name": "Jane Doe",
  "phone": "+584241234567",
  "email": "jane@example.com",
  "password": "aStrongPassword"
}
```

**Responses:**

| Code | When it happens |
|--------|----------------|
| `201`  | Account created successfully. |
| `409`  | An account with that `phone` or `email` already exists. |
| `422`  | A field is missing, or has the wrong type (for example, `phone` as a number instead of text). |

Registering does **not** automatically log you in: after a `201`, you have to call `/auth/login` to get a token.

### `POST /auth/login`

Verifies the credentials and returns a token.

**Request body:**

```json
{
  "email": "jane@example.com",
  "password": "aStrongPassword"
}
```

**Response (`200`):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

If the email doesn't exist or the password doesn't match, the response is `401 Unauthorized` with a generic message ("Incorrect email or password") — on purpose it doesn't distinguish which of the two failed, so as not to reveal which emails are registered (see `docs/en/backend/api.md`).

### How to use the token

Every route described below, except the two under `/auth`, requires sending the token in the `Authorization` header, with the `Bearer` scheme:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

If the header is missing, malformed, or the token has expired or is invalid, the API responds `401 Unauthorized` before running any business logic (see `docs/en/backend/auth.md`). The token expires 30 days after being issued (see `docs/en/backend/auth.md`); after that, you have to log in again — there's no (yet) automatic refresh mechanism.

## User endpoints

### `GET /users/me`

Returns the data of the user who owns the token. Takes no parameters: "whose data is this" is decided by the token, never a URL with an `id` (see `docs/en/backend/api.md`).

**Response (`200`):**

```json
{
  "id": 5,
  "name": "Jane Doe",
  "phone": "+584241234567",
  "email": "jane@example.com"
}
```

Note that the password or its hash is never returned.

### `PUT /users/me`

Edits the authenticated user. Accepts **any subset** of these fields — only what's sent gets updated, the rest stays the same:

```json
{
  "name": "New Name"
}
```

The possible fields are `name`, `phone`, `email` and `password` (if `password` is sent, it's re-hashed on the server; you never need to send the hash, only the new plain text). The response (`200`) is the full, already-updated user, with the same shape as `GET /users/me`.

| Code | When it happens |
|--------|----------------|
| `200`  | Update succeeded. |
| `400`  | The body carried no field to update (`{}`). |
| `409`  | The new `phone` or `email` already belongs to another account. |
| `401`  | Token missing, invalid, or expired. |

## Contact endpoints

Contacts are the people who must be notified when the user triggers an alert. Every endpoint in this group requires the `Authorization` header and only affects the contacts of the user who owns the token — there's no way to read or edit another account's contacts.

### `POST /contacts`

Creates a new emergency contact.

**Request body:**

```json
{
  "name": "John Doe",
  "phone": "+584161234567",
  "email": null
}
```

`email` is optional (it can be omitted or sent as `null`); `name` and `phone` are required. Response: `201` with no relevant body.

A user can have at most 4 emergency contacts. Trying to add a 5th returns `400` with `{"detail": "You can have at most 4 emergency contacts"}` — the app is expected to stop offering the "add contact" action once `GET /contacts` (see below) returns 4 rows, so hitting this in practice means the app's own count is stale.

If `email` is sent, the API fires off a confirmation email to that address in the background (it doesn't block the `201` response, see `docs/en/backend/notifications.md`), with a link to `GET /contacts/confirm/{token}`. Until the contact confirms by clicking that link, `confirmed` stays `false` in `GET /contacts` (see below). If `email` isn't sent, there's currently no way to confirm it and it stays `false` indefinitely.

### `GET /contacts`

Lists all of the authenticated user's contacts.

**Response (`200`):**

```json
[
  {
    "id": 1,
    "name": "John Doe",
    "phone": "+584161234567",
    "email": null,
    "confirmed": false,
    "telegram_linked": false
  }
]
```

`confirmed` indicates whether that contact has already agreed to receive alerts by email; `telegram_linked` is the same idea for the Telegram channel (see below) — the two are independent, a contact can have either, both, or neither.

### `GET /contacts/confirm/{token}`

The only endpoint in this group that does **not** require the `Authorization` header — on purpose: this endpoint is reached by clicking the link in the confirmation email (see `POST /contacts` above), not from a session logged into the app. The `token` in the URL isn't the same kind of token as `access_token` (it doesn't work to authenticate against any other endpoint, and vice versa: a session `access_token` doesn't work here).

Unlike every other endpoint in this API, **this one doesn't return JSON** — it returns a rendered HTML page (`Content-Type: text/html`), since whoever hits it is a person clicking a link in their browser, not an API client. This isn't meant to be called from application code; if the future app ever needs to check a contact's confirmation status programmatically, that's what `GET /contacts` (`confirmed` field) is for.

**Responses:**

| Code | When it happens |
|--------|----------------|
| `200`  | The contact was marked as confirmed. Renders a success page. |
| `401`  | The token is invalid, isn't of the expected type, or has already expired (expires 7 days after being issued). Renders an error page. |
| `404`  | The token was valid but the contact it points to no longer exists. Renders an error page. |

### `PUT /contacts/{id}`

Edits an existing contact, identified by its `id` (the same one returned by `GET /contacts`). Same as `PUT /users/me`, it only accepts the fields you want to change:

```json
{
  "phone": "+584169998877"
}
```

| Code | When it happens |
|--------|----------------|
| `200`  | Update succeeded; returns the full updated contact. |
| `400`  | The body carried no field to update. |
| `404`  | No contact with that `id` **belonging to the authenticated user** exists (includes the case where the `id` exists but belongs to another account — deliberately not distinguished, see `docs/en/backend/api.md`). |
| `401`  | Token missing, invalid, or expired. |

### `POST /contacts/{id}/telegram/enable`

Starts (or restarts) the Telegram-linking process for a contact: generates a fresh, single-use link, valid for 24 hours.

**Response (`200`):**

```json
{ "telegram_link_url": null }
```

- If the contact has an `email` on file, the API emails them the deep link in the background (same pattern as `POST /contacts`, see `docs/en/backend/notifications.md`) and `telegram_link_url` comes back `null` — there's nothing for the app to do besides let the user know an email was sent.
- If the contact has **no** `email`, there's no address to send it to, so the API returns the link directly: `{ "telegram_link_url": "https://t.me/SomeBot?start=..." }`. The app is expected to offer that link to be shared manually (copy to clipboard, native share sheet, etc.).

Calling this again for the same contact invalidates any link generated by a previous call — only the most recent one still works.

| Code | When it happens |
|--------|----------------|
| `200`  | Link generated (and emailed, if the contact has an address). |
| `404`  | No contact with that `id` belonging to the authenticated user exists. |
| `401`  | Token missing, invalid, or expired. |

### `DELETE /contacts/{id}/telegram`

Unlinks Telegram from a contact: clears the stored `chat_id` (and any pending, unredeemed link token). The contact stops receiving Telegram notifications immediately; their email confirmation status, if any, is untouched.

| Code | When it happens |
|--------|----------------|
| `204`  | Unlinked (or was already not linked — this endpoint is idempotent). |
| `404`  | No contact with that `id` belonging to the authenticated user exists. |
| `401`  | Token missing, invalid, or expired. |

## Alert endpoints

### `POST /alerts`

Logs the panic button being triggered, saves its initial location, and notifies every contact on each active email, Telegram, WhatsApp, and SMS channel. The response starts a 60-minute live-tracking session.

**Request body:**

```json
{
  "latitude": 10.4880600,
  "longitude": -66.8791500
}
```

**Responses:**

| Code | When it happens |
|--------|----------------|
| `201`  | Alert logged. Notifications run in background tasks. The response includes `publisher_token` and `tracking_expires_at` for the tracking WebSocket. |
| `401`  | Token missing, invalid, or expired. |
| `422`  | `latitude` or `longitude` is missing, or isn't a number. |

If the user has no reachable contact, the alert is still logged — there is just no one to notify yet.

The publisher token is scoped to this alert and cannot authenticate normal API calls. Connect to `WS /alerts/{id}/track` and send `{"type":"auth","token":"..."}` as the first frame. The complete message contract is in `docs/backend/realtime-geolocation.md`.

### `GET /alerts`

Lists the authenticated user's own alert history, most recent first, including who was notified for each one and whether they've opened the location link yet.

**Response (`200`):**

```json
[
  {
    "id": 6,
    "created_at": "2026-07-30T09:51:35",
    "latitude": 10.4806,
    "longitude": -66.9036,
    "notifications": [
      { "channel": "email", "viewed_at": "2026-07-30T09:51:44", "contact_name": "Ana Martinez" },
      { "channel": "telegram", "viewed_at": null, "contact_name": "Ana Martinez" }
    ]
  }
]
```

A contact confirmed by both email and Telegram appears twice in `notifications` for the same alert — one entry per channel, each with its own independent `viewed_at` (`null` until that specific link has been opened at least once). There's no `GET /alerts/{id}` for a single alert; the full list is small enough (see `docs/en/backend/api.md`) that this one endpoint covers both the dashboard's list view and any future per-alert detail view.

| Code | When it happens |
|--------|----------------|
| `200`  | Always, even with an empty `[]` if the user has never triggered an alert. |
| `401`  | Token missing, invalid, or expired. |

### `GET /alerts/view/{token}`

This is the link embedded as `map_url` in every panic notification. Opening it marks that specific notification as viewed and renders the embedded live map. Its WebSocket at `/alerts/view/{token}/live` sends the saved route snapshot and subsequent positions. The signed link expires after 30 days.

| Code | When it happens |
|--------|----------------|
| `200`  | Token valid. Renders the live map (`text/html`). |
| `401`  | The token is invalid or malformed. Renders an error page (`text/html`, same as `GET /contacts/confirm/{token}`). |
| `404`  | The token was valid but the notification it points to no longer exists. Renders an error page. |

### `POST /alerts/{id}/stop`

Ends an authenticated user's active tracking session and broadcasts the ended state to every open contact map. It is safe to call when the session already ended.

## Examples in Python

Using the `requests` library (`pip install requests`, or, if the client is also a `uv` project, `uv add requests`):

```python
import requests

BASE_URL = "http://127.0.0.1:8000"


def register(name, phone, email, password):
    resp = requests.post(f"{BASE_URL}/auth/register", json={
        "name": name,
        "phone": phone,
        "email": email,
        "password": password,
    })
    resp.raise_for_status()  # raises an exception if the code isn't 2xx
    return resp.json()


def login(email, password):
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email,
        "password": password,
    })
    resp.raise_for_status()
    return resp.json()["access_token"]


def get_my_user(token):
    resp = requests.get(f"{BASE_URL}/users/me", headers={
        "Authorization": f"Bearer {token}",
    })
    resp.raise_for_status()
    return resp.json()


def create_contact(token, name, phone, email=None):
    resp = requests.post(f"{BASE_URL}/contacts",
        json={"name": name, "phone": phone, "email": email},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()


# Usage:
token = login("jane@example.com", "aStrongPassword")
user = get_my_user(token)
create_contact(token, "John Doe", "+584161234567")
```

`resp.raise_for_status()` is `requests`'s way of turning a `4xx`/`5xx` code into an exception (`requests.HTTPError`) instead of letting the code carry on as if nothing happened — it's worth wrapping these calls in a `try/except` to show the end user an appropriate message based on the code (for example, distinguishing a `401` from a `409`).

## Examples in JavaScript (built with Capacitor in mind)

A Capacitor app is, under the hood, a WebView running standard JavaScript/TypeScript — so the most direct way to talk to the API is `fetch`, available with nothing to install:

```javascript
const BASE_URL = "http://127.0.0.1:8000";

async function register(name, phone, email, password) {
  const resp = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone, email, password }),
  });
  if (!resp.ok) throw new Error(`Error ${resp.status} registering`);
  return resp.json();
}

async function login(email, password) {
  const resp = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) throw new Error(`Error ${resp.status} logging in`);
  const data = await resp.json();
  return data.access_token;
}

async function getMyUser(token) {
  const resp = await fetch(`${BASE_URL}/users/me`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Error ${resp.status} fetching the user`);
  return resp.json();
}

async function createContact(token, name, phone, email = null) {
  const resp = await fetch(`${BASE_URL}/contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ name, phone, email }),
  });
  if (!resp.ok) throw new Error(`Error ${resp.status} creating the contact`);
}

// Usage:
const token = await login("jane@example.com", "aStrongPassword");
const user = await getMyUser(token);
await createContact(token, "John Doe", "+584161234567");
```

## Capacitor-specific considerations

Two things to keep in mind once this client stops being an example and becomes the real app, neither of them solved yet on the backend side:

- **CORS**: in the browser or in Capacitor's WebView, requests to an origin different from the app's own (for example, the app runs at `capacitor://localhost` and the API at `http://192.168.x.x:8000`) are subject to the browser's CORS policy. FastAPI does **not** ship with CORS enabled by default — today the API only responds without issue to requests that don't depend on that policy (like the Python examples above, which don't run in a browser). Before the Capacitor app can talk to this API directly from JavaScript, `CORSMiddleware` will need to be added to `main.py` with the allowed origins — left pending until app development starts.
- **Where to store `access_token`**: the examples above don't show where to persist the token between app launches — `localStorage` works but isn't meant for sensitive data on a mobile device. For the real app, it's better to use a Capacitor plugin built for this (for example, `@capacitor/preferences` at minimum, or a secure/encrypted storage option for something stronger) instead of plain `localStorage`.
