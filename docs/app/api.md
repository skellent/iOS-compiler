# `src/lib/api.js`

## Purpose

The only file in the app that calls `fetch()` against the backend. Every other module — every view, `main.js`'s router — goes through the `Api` object this file exports instead of building request URLs or reading response bodies itself:

```js
export const Api = {
  register: (data) => request("/auth/register", { method: "POST", body: data }),
  login: (data) => request("/auth/login", { method: "POST", body: data }),

  getMe: () => request("/users/me", { auth: true }),
  updateMe: (data) => request("/users/me", { method: "PUT", body: data, auth: true }),

  listContacts: () => request("/contacts", { auth: true }),
  createContact: (data) => request("/contacts", { method: "POST", body: data, auth: true }),
  updateContact: (id, data) => request(`/contacts/${id}`, { method: "PUT", body: data, auth: true }),
  deleteContact: (id) => request(`/contacts/${id}`, { method: "DELETE", auth: true }),

  enableContactTelegram: (id) => request(`/contacts/${id}/telegram/enable`, { method: "POST", auth: true }),
  disableContactTelegram: (id) => request(`/contacts/${id}/telegram`, { method: "DELETE", auth: true }),

  createAlert: (data) => request("/alerts", { method: "POST", body: data, auth: true }),

  getFeatures: () => request("/features"),
};
```

This mirrors `backend/API.md` one endpoint at a time — every route the backend exposes for a logged-in user to consume has exactly one matching `Api.*` function here, named after the same action rather than the raw HTTP verb+path, the same way `modules/routers/*.py` groups endpoints by resource on the backend side. `register`, `login` and `getFeatures` are the only three entries without `auth: true`: `register`/`login` can't carry a session token yet — they're what produces one — while `getFeatures` is deployment-wide by design (see `docs/backend/features.md`) and its answer doesn't depend on who's asking. There's deliberately no `Api.*` wrapper for `POST /telegram/webhook` — that endpoint is never called from this app at all, only by Telegram's own servers (see `docs/backend/telegram.md`).

`getFeatures` is never called directly from a view — `lib/features.js` wraps it in a small cache (a module-level promise, reused for the rest of the app's lifetime instead of re-fetching) since the answer can't change while the app is running, and falls back to `{ telegram: false }` if the call itself fails, so a flaky network hides the Telegram UI rather than crashing whichever screen asked. `src/views/contacts.js` is the only caller today, deciding whether to render the "Connect Telegram" button and badge at all (see `screens.md`).

## Why a shared `request()` instead of one `fetch()` call per function

```js
async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  ...
}
```

Every one of the ten endpoints needs the same two things: a JSON `Content-Type` header, and JSON-encoding the request body when there is one — most of them also need the session token attached as `Authorization: Bearer <token>` (see `docs/backend/dependencies.md` for how the backend reads that same header). Writing that logic ten times would mean ten places to keep in sync if, for example, the token header name ever changed; `auth: true` is the one bit each endpoint definition needs to opt into it.

## `BASE_URL` and `import.meta.env.API_BASE_URL`

```js
const BASE_URL = import.meta.env.API_BASE_URL;
```

See `docs/app/architecture.md` for the full explanation: this isn't a real runtime property access (there's no `import.meta.env` object in a browser), it's a build-time placeholder `build.js` replaces with a literal string via `Bun.build()`'s `define` option, sourced from `app/.env`'s `API_BASE_URL`. By the time this code reaches a device, the line reads as `const BASE_URL = "http://10.0.2.2:8000";` (or whatever that environment's `.env` set) — a plain string, no environment lookup happening on the phone at all.

## `ApiError` and `extractMessage`: turning the backend's error shapes into one message

```js
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function extractMessage(body) {
  if (!body) return t("errors.generic");
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  return t("errors.generic");
}
```

FastAPI's error responses take two different shapes depending on what went wrong (see `backend/API.md`): a raised `HTTPException(status_code=..., detail="...")` produces `{"detail": "some string"}` (a `409` for a duplicate email, a `401` for a bad login, a `403` for an unconfirmed account, a `404` for a missing contact), while a `422` from Pydantic's own request validation produces `{"detail": [{"loc": [...], "msg": "...", ...}, ...]}` — a list of per-field problems, not a single string. `extractMessage` normalizes both into one human-readable string (taking the first validation message when there are several) so every view can display `error.message` without needing to know or check which shape the backend happened to return for that particular failure. This is also what lets the login screen surface the backend's exact wording ("Please confirm your email before logging in") without any special-casing on the app side — it's just whatever string `extractMessage` found in `detail`.

`ApiError` carries the HTTP `status` alongside the message, even though most call sites only read `.message` — it's there for the cases that do care which failure happened, not just that one did.

A network failure (no connectivity, DNS failure, the backend simply not running) never reaches the "parse the response body" stage at all — `fetch()` itself rejects — so `request()` catches that separately and raises its own `ApiError(t("errors.network"), 0)`, giving the UI a message to show even when there was no HTTP response to read a `detail` field from. Both fallback strings come from `lib/i18n.js` (see `architecture.md`), not a hardcoded English literal — the only messages in this file that are ever translated, since every other message comes straight from the backend's own `detail` field, in whatever language the backend happens to respond in.

## Relationship with the rest of the app

`src/lib/session.js` is `api.js`'s dependency for `getToken()` (attaching the `Authorization` header); `src/lib/i18n.js` is its dependency for the two fallback error strings above. Every view module (`src/views/*.js`) and `src/main.js` depend on `api.js`, never on `fetch` directly — keeping the backend's actual URL shape (paths, JSON field names) known in exactly one file, the same boundary `modules/cursor.py` keeps around `mariadb` on the backend side (see `docs/backend/cursor.md`). `src/lib/features.js` is the one exception that doesn't call `Api.*` directly from a view: it sits between `Api.getFeatures` and `src/views/contacts.js`, caching the one call every screen that cares about Telegram availability would otherwise have to repeat.
