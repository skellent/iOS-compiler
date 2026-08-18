# PanicButton — Bug List

Findings from a full read of `backend/` and `app/src/`, plus the built bundle `app/www/js/main.js`.

---

## How this list is divided

Every item is sorted by **whether fixing it requires building and redistributing a new app binary (APK/IPA)**.

The rule comes from the app-online architecture: the WebView loads its UI live from the backend's `/app` route, so anything under `app/www` or `backend/` reaches an already-installed phone on its own, via the `/app/manifest` hash check on launch/resume. Anything compiled *into* the installed binary does not — no matter what the server says.

**Requires a new binary** — changes to `capacitor.config.js`, a new or updated Capacitor plugin, `AndroidManifest.xml`, `Info.plist`, or anything under `android/` or `ios/`.

**Does not require a new binary** — anything in `backend/`, anything in `app/src/` (delivered by `bun run build` + backend redeploy), and anything that is only docs or repo tooling.

**Headline: 26 of the 27 bugs need no binary rebuild.** Only one item has a variant that does.

| Part | Items | What deploying them takes |
|---|---|---|
| Part 1 | B-01 … B-27 (all but the B-21 variant) | Backend redeploy, and/or `bun run build` + redeploy |
| Part 2 | B-21b only | `./gradlew assembleRelease` + redistribute the APK |

Status tags: **[FIXED]** shipped in `866c5a2`. **[OPEN]** not addressed.

---

# Part 1 — No app binary rebuild required

## Critical

### B-01 — "Create Account" button does nothing  **[FIXED — `866c5a2`]**
`www` · delivered by live reload

**Symptom:** Tapping the submit button on the Register screen did nothing. No toast, no spinner, no error. Backend logs showed no request arriving.

**Root cause:** `app/src/views/register.js`

```js
const button = form.querySelector("button");
```

`querySelector("button")` returns the **first** `<button>` in the form. The five email-domain chips (`@gmail.com`, …) render before the submit button, so `button` was the `@gmail.com` chip.

The chip has no `.btn-label` / `.btn-spinner` children, so `setLoading(button, true)` (`dom.js:9`) threw `TypeError: Cannot set properties of null`. That call sat **outside** the `try`, so the exception escaped the submit listener — the handler aborted before `Api.register()` was ever called. Hence the silence, and hence the empty backend logs: the app never contacted the server.

**Fix shipped:**
```js
const button = form.querySelector('button[type="submit"]');
...
try {
  setLoading(button, true);      // moved inside the try
  await Api.register(data);
```

**Also fixed:** `login.js` carried the identical loose selector. It worked only because its form contained exactly one button — it would have broken the same way the moment a second was added. Both files now use the scoped selector, and the bundle contains zero loose `querySelector("button")` calls.

---

### B-02 — One shared DB cursor across all request threads  **[OPEN]**
`backend`

`backend/modules/db.py` creates a single global `Cursor`, and every router is a **sync** `def`, which FastAPI runs in a threadpool. Multiple requests share one connection and one cursor concurrently.

`cursor.lastrowid` and `cursor.rowcount` are read *after* a separate `execute()`, so a second thread can overwrite cursor state in between:

```python
cursor.execute(Queries.INSERT_USER, (...))   # auth.py:23
cursor.commit()
user_id: int = cursor.lastrowid              # auth.py:31 — may be another request's id
```

**Consequences:** confirmation emails sent with the wrong `user_id`, alert notifications attached to the wrong alert, ownership checks reading another query's result. `mariadb` connections are also not thread-safe, so interleaved `execute()` can corrupt the protocol.

Affects `auth.py:31`, `contacts.py:34`, `alerts.py:26`, `alerts.py:45`, and every `rowcount` check.

---

### B-03 — `current_user` accepts any valid token type  **[OPEN]**
`backend`

`backend/modules/dependencies.py:9` — `Token.Validate` checks signature and expiry but **not** the `type` claim, and `Token.Create` sets no `type` at all, so the separation only runs one way.

A confirmation or alert-view token presented as a Bearer token passes the `None` check, then `payload["sub"]` raises `KeyError` → **HTTP 500** instead of 401. The alert-view token is the worrying one: unauthenticated, permanent (`token.py:66` sets no `exp`), and mailed to third parties.

Not privilege escalation today (those payloads carry no `sub`), but it is a 500 on attacker-controlled input.

---

### B-04 — No rate limiting anywhere  **[OPEN]**
`backend`

- `POST /auth/login` — unlimited password guessing.
- `POST /auth/register` — each call sends an email via the Workspace SMTP account. An unauthenticated loop burns the daily quota and turns the API into a spam relay for arbitrary addresses.
- `POST /alerts` — unlimited fan-out to a user's contacts.

---

### B-05 — Shipped bundle was stale  **[FIXED — `866c5a2`]**
`www`

`app/www/js/main.js` was older than `app/src/views/register.js`, meaning `bun run build` had not run since the last source edit. Since the WebView loads `www/` live, the stale bundle was what users actually ran.

Rebuilt and committed. Note this is a recurring hazard, not a one-off — see **U-25** for the CI check that prevents it.

---

## High

### B-06 — Home status chip undercounts who will be notified  **[OPEN]**
`www`

`app/src/views/home.js:143`

```js
const confirmedCount = contacts.filter((contact) => contact.confirmed).length;
```

Only email-confirmed contacts are counted. The backend notifies on `confirmed = TRUE OR telegram_chat_id IS NOT NULL`.

A user whose contacts are all Telegram-linked sees "no contacts will be notified" on the panic screen while the alert would in fact reach everyone. On a safety app, that is the worst direction for the error to point. Should be `contact.confirmed || contact.telegram_linked`.

### B-07 — No server-side input validation  **[OPEN]**
`backend`

`backend/modules/types.py` types everything as bare `str`:

- `email: str` — not `EmailStr`. `POST /auth/register` accepts `"abc"`, creates the account, then the confirmation email fails. The user is stuck: unconfirmed, unable to log in, unable to re-register (the UNIQUE constraint now holds their address).
- `password: str` — no minimum length. The 8-char rule exists only as an HTML `minlength` on a form marked `novalidate`.
- `phone: str` — no format check.

### B-08 — Contact email: app, backend, and docs disagree  **[OPEN]**
`www` + `backend` + docs

Backend has `Contact.email` as `str | None`; docs describe email-less contacts as Telegram-only; the app hard-blocks submit without an email (`contacts.js:216`). The Telegram-only path is unreachable from the app.

### B-09 — Contact limit is check-then-act  **[OPEN]**
`backend`

`contacts.py:29` counts, then inserts. Two concurrent `POST /contacts` both read `total = 3` and both insert. Nothing at schema level enforces the cap.

### B-10 — Telegram send failures unhandled in the background task  **[OPEN]**
`backend`

`alerts.py:33` wraps the mail batch in `_notify_by_mail` to swallow `MailNotSentError`. The Telegram batch gets no equivalent, and `Telegram.SendBulk` raises `TelegramNotSentError` on any failed chat. Queued last so it blocks nothing today — but the asymmetry is accidental, and reorders into a real bug.

---

## Medium

### B-11 — Telegram link built with `None` when username is unset  **[OPEN]**
`backend` — `contacts.py:139` emails `https://t.me/None?start=...` if `TELEGRAM_BOT_USERNAME` is unset while the token is set. `GET /features` guards the app UI, not the endpoint.

### B-12 — `/app/manifest` rehashes the entire `www/` per request  **[OPEN]**
`backend` — `app_assets.py:9` reads and SHA-256s every file, including images and the 185 KB bundle, on every app launch and every resume, for every device. No caching, no mtime short-circuit.

### B-13 — Splash screen can hang forever  **[OPEN]**
`www` — *note: fixable without a binary rebuild*

`app/src/main.js:127` — with `launchAutoHide: false`, any throw in `loadLanguage()`, `loadTheme()`, `loadAccentColor()` or `renderCurrentRoute()` skips `SplashScreen.hide()` and strands the app on the splash permanently. Already flagged in `docs/en/app/architecture.md` as a bug hit in development; still unguarded.

The `launchAutoHide` config lives in the binary, but the fix does not — wrapping `boot()` in `try/finally` is a `www` change. See **U-10**.

### B-14 — Naive timestamp compared against MariaDB `NOW()`  **[OPEN]**
`backend` — `contacts.py:130` stores `datetime.now()` (process local time); the check runs as `telegram_link_expires_at > NOW()` (MariaDB session timezone). Mismatched zones expire links early or late. `token.py` correctly uses `datetime.now(timezone.utc)`.

### B-15 — Geolocation error bypasses i18n  **[OPEN]**
`www` — `geolocation.js:11` throws a hardcoded English string that `home.js:110` displays directly. Users in the other 11 languages get English on the panic screen.

### B-16 — Placeholder response bodies in the public API  **[OPEN]**
`backend` — `POST /auth/register`, `POST /contacts`, `POST /alerts` all return `{"Skellent": "Success!"}`. A developer's handle as a production API contract. Worse for `/alerts`: no alert id returned, so clients can't reference what they created.

### B-17 — Config crashes with an unhelpful error  **[OPEN]**
`backend` — `credentials.py:13`, `int(os.getenv("PORT"))` raises `TypeError` if `PORT` is missing, instead of saying so.

### B-18 — `.env` re-read from disk on every call  **[OPEN]**
`backend` — `get_credentials()` calls `load_dotenv(override=True)` every invocation, from eight modules. Caching is inconsistent: `mail.py`/`telegram.py` snapshot at import, `main.py` calls it twice in a row (lines 17–18).

### B-19 — `diffFields` sends `""` where the backend expects `null`  **[OPEN]**
`www` — `contacts.js:296`. Clearing an email yields `"" !== null` → sends `email: ""`, stored as empty string rather than `NULL`, which then reads truthy in `if contact["email"]` (`alerts.py:65`, `contacts.py:141`).

### B-20 — Native `confirm()` blocks the WebView  **[OPEN]**
`www` — `contacts.js:271` uses `confirm()` for delete confirmation, the one place dropping to a blocking native dialog instead of the app's own `lib/sheet.js`.

### B-21 — Telegram link is copied to the clipboard, not shared  **[OPEN]**
`www` — for the honest-failure fix

`contacts.js:249` writes the link to `navigator.clipboard` inside a `try {} catch {}` that swallows failures, then unconditionally shows a "link ready" toast. If the write fails the user is told it succeeded and the link is gone, with no way to retrieve it short of regenerating.

Making the toast reflect reality (and showing the URL as selectable text on failure) is a `www` change. **Implementing the actual OS share sheet the docs describe is not — see B-21b in Part 2.**

### B-22 — `GET /alerts` is N+1  **[OPEN]**
`backend` — `alerts.py:99` issues one query per alert. 50 alerts = 51 round trips on the single shared connection.

### B-23 — `SetWebhook` registers a null secret  **[OPEN]**
`backend` — `telegram.py:73` posts `secret_token: null` when unset, and `routers/telegram.py:39` then skips auth entirely. A deployment with a bot token but no webhook secret has a fully open webhook, with nothing logged.

---

## Low

### B-24 — `app/README.md:27` links to a non-existent `NGINX.md`  **[OPEN]** — docs
### B-25 — Duplicate `pointerleave` listener  **[OPEN]** — `www`, `home.js:151` and `:153`
### B-26 — Reconnect retry loses the `IntegrityError` translation  **[OPEN]** — `backend`, `cursor.py:97`; a UNIQUE violation on the retry surfaces as a 500, not a 409
### B-27 — Unguarded index into a possibly-empty result  **[OPEN]** — `backend`, `alerts.py:52` reads `user_rows[0]` with no existence check; reachable with a valid 30-day JWT for a since-purged user

---

# Part 2 — App binary rebuild required

Exactly one item, and it is the optional half of B-21.

### B-21b — A real OS share sheet for the Telegram link  **[OPEN]**
**Needs:** `@capacitor/share` plugin → `bunx cap sync` → `./gradlew assembleRelease` → redistribute APK

`docs/en/backend/notifications.md` says the link URL is handed back "so the app can offer it via the OS share sheet." No share sheet exists; `contacts.js:249` uses the clipboard.

Delivering the documented behaviour means adding a Capacitor plugin, which is native code. The plugin's Java/Swift cannot arrive over the live-reload path — a phone with the app already installed keeps running the native code it shipped with until it installs a new APK.

**Recommendation:** fix the honest-failure half now (B-21, `www`), and fold the share sheet into whichever build produces your first Play Store binary. That also settles the doc drift in **U-21** without a separate release.

---

# Conflict check against the shipped fix

Verified the `866c5a2` fix (`register.js` + `login.js`) against every other item. **No conflicts.** Three interactions worth recording:

**1. B-07 and B-04 became reachable — their severity went up, not down.**
While the button was dead, `POST /auth/register` could not be triggered from the app at all. It now can. That means the missing email validation (B-07) and the missing rate limit (B-04) are live from the moment this deploys. The first real signup with a typo'd address produces an account that can never be confirmed and can never be re-registered. **B-07 is the item I would fix next.**

**2. B-02's `lastrowid` race now applies to registration.**
`auth.py:31` reads `cursor.lastrowid` right after inserting the user, to build the confirmation token. With registration previously unreachable from the app, this path was effectively dormant. Concurrent signups can now mail a confirmation link for the wrong account.

**3. B-16 does not conflict.**
`register.js` discards the response body (`await Api.register(data)`, result unused) and `api.js:39` parses any valid JSON, so `{"Skellent": "Success!"}` passes through harmlessly. Replacing it later will not break the register screen.

Two list items were made obsolete by the fix and are marked **[FIXED]** above: **B-01** and **B-05**. Two upgrade items cite B-01 as motivation — **U-15** (tests) and **U-20** (component helper). Both remain valid: they are about preventing the next occurrence, not this one.
