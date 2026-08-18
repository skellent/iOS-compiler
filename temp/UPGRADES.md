# PanicButton — Proposed Upgrades

Improvements beyond fixing the defects in `BUGS.md`.

---

## How this list is divided

Same axis as `BUGS.md`: **whether the upgrade requires building and redistributing a new app binary (APK/IPA)**.

The app-online architecture means `backend/` and `app/www` changes reach installed phones on their own, through the `/app/manifest` hash check on launch and resume. Native code does not — a phone keeps running the binary it installed until it installs a new one.

**Requires a new binary** — `capacitor.config.js`, a new or updated Capacitor plugin, `AndroidManifest.xml`, `Info.plist`, anything under `android/` or `ios/`.

**Does not require a new binary** — `backend/`, `app/src/`, docs, repo tooling.

**Headline: 25 of the 27 upgrades need no binary rebuild.** One requires it outright; one requires it conditionally.

| Part | Items | What deploying them takes |
|---|---|---|
| Part 1 | U-01 … U-11, U-13 … U-27 | Backend redeploy, and/or `bun run build` + redeploy |
| Part 2 | U-12, and U-26 when a plugin version moves | `./gradlew assembleRelease` + redistribute the APK |

---

# Part 1 — No app binary rebuild required

## Security

### U-01 — Rate limiting on the exposed endpoints — `backend`
Add `slowapi` (or nginx `limit_req`) with per-IP limits on `/auth/login` and `/auth/register`, and a per-user limit on `POST /alerts`. Registration is the urgent one: it triggers an outbound email to an attacker-chosen address with no authentication in front of it — a quota risk and a sending-domain reputation risk.

**Now higher priority than when first written:** the Create Account button was dead when this list was drafted, so the endpoint was unreachable from the app. It works now.

### U-02 — Give login tokens a `type` claim — `backend`
`Token.Create` is the only one of the four builders with no `type`. Add `"type": "session"` and check it in `current_user`. Closes B-03 permanently instead of relying on other payloads happening not to carry a `sub`.

### U-03 — Shorten the session token, add refresh — `backend` + `www`
30 days is long for a bearer token with no revocation path: no server-side logout, no token version, no denylist. A leaked token is valid for a month and nothing can stop it. Short access token (30–60 min) plus a refresh token in `Preferences`, with a `token_version` column that password changes increment.

The app-side half (`session.js`, `api.js`) is a `www` change — no binary needed.

### U-04 — Scope the alert-view token — `backend`
`CreateAlertNotificationView` issues a permanent, unauthenticated token revealing someone's location, sent to third parties by email and Telegram. The reasoning in `auth.md` (a contact may reopen the map days later) is sound, but "days" and "forever" aren't the same requirement. 30 days preserves the use case and bounds the exposure.

### U-05 — Validate input with Pydantic's real types — `backend`
`EmailStr`, `constr(min_length=8)`, a phone regex matching what `combinePhone` produces. Small edit to `types.py`; closes B-07.

**This is the one I would do first.** Now that registration actually reaches the backend, a typo'd email creates an account that can never be confirmed and never re-registered.

### U-06 — Security headers middleware — `backend`
No `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, or CSP on the server-rendered pages. The dashboard handles JWTs in `sessionStorage` and is the page most worth protecting.

### U-07 — `response_model` on user endpoints — `backend`
`SELECT_USER_BY_EMAIL` pulls `password_hash` because login needs it; `SELECT_USER_BY_ID` omits it. Correct today, but by convention only. A `UserPublic` response model on `/users/me` makes it structural.

### U-08 — Constant-time webhook secret comparison — `backend`
`routers/telegram.py:39` uses `!=`. Use `secrets.compare_digest`. One line.

## Stability

### U-09 — Replace the shared cursor with a connection pool — `backend`
**Highest-value change in this document.** `mariadb.ConnectionPool`, or a per-request connection via a FastAPI dependency, fixes B-02 at the root. The current design cannot be made safe with a patch — every `lastrowid` and `rowcount` read is a race until the connection stops being shared. `CLIENT.FOUND_ROWS` carries over unchanged, and pooling makes the reconnect logic largely redundant.

### U-10 — Wrap `boot()` in `try/finally` — `www`
```js
try { /* existing boot body */ }
finally { await SplashScreen.hide(); }
```
Two lines converting B-13's permanent hang into a visible error screen. With no bundled fallback, a network blip during boot is a realistic trigger.

**Worth noting:** `launchAutoHide: false` lives in the binary, but this fix does not. It ships over live reload like any other `www` change — no APK.

### U-11 — Cache the `/app/manifest` hash — `backend`
Key the SHA-256 on the max mtime across `www/`, recompute only on change. Or compute once at startup, since deploys restart the process anyway.

### U-13 — Health check endpoint — `backend`
`GET /health` verifying DB connectivity. Nothing currently distinguishes "process up" from "process up but MariaDB gone," and `Cursor._connect` calls `sys.exit(1)` at import time on failure.

### U-14 — Retry / dead-letter for failed notifications — `backend`
A failed panic alert notification is logged and dropped — the highest-consequence failure in the system. `alert_notifications` already has the rows; adding `delivery_status` and a retry pass makes failures recoverable rather than merely observable.

## Maintainability

### U-15 — Automated tests — repo
There are none. `pytest` + `httpx.AsyncClient` against a test database covering the auth flow, contact CRUD, and alert fan-out.

Still motivated by B-01 even though it's fixed: a dead primary button on the registration screen is exactly what one smoke test catches, and it reached the shipped bundle.

### U-16 — A migration tool — `backend` / repo
`queries/tables.sql` is applied by hand and the docs call it the source of truth, but nothing records which schema version a database is on. Alembic, or a numbered `migrations/` directory with a tracking table — before the schema needs its first production change.

### U-17 — Single source of truth for shared constants — `backend` + `www`
`MAX_CONTACTS = 4` is declared in `routers/contacts.py:20` and again in `views/contacts.js:12`. `EMAIL_DOMAINS` and `insertEmailDomain` are duplicated verbatim between `register.js` and `contacts.js`. Serve limits from `GET /features`; move the email-chip helper into `lib/`.

### U-18 — Whitelist columns in both dynamic-UPDATE builders — `backend`
`users.py` maps fields through `_COLUMN_BY_FIELD` before interpolating into SQL; `contacts.py:100` interpolates keys directly. Both are safe today because Pydantic constrains the keys, but only one is safe *by construction*.

### U-19 — Extract a repository layer — `backend`
Routers mix HTTP concerns, SQL, and notification dispatch. `create_alert` is 50 lines doing all three. A thin `repositories/` layer makes routers readable and testable without a live database.

### U-20 — A component helper for the app's views — `www`
Every view builds a template string and re-queries the DOM for its own elements. The no-framework choice is defensible at this size, but B-01 was a direct consequence of hand-written `querySelector` calls with no safety net. A ~30-line `html()` + `refs()` helper, no dependency, eliminates the class of bug.

Still worth doing after the B-01 fix: the fix corrected two call sites, not the pattern that produced them.

### U-21 — Reconcile the docs with the code — docs
The docs are good and clearly maintained, which makes the drift worth correcting:

- `app/README.md:27` references a non-existent `NGINX.md` (B-24).
- `notifications.md` describes an OS share sheet for Telegram links; the code uses the clipboard (B-21). **Resolving this fully is the one binary-dependent item — see B-21b.** Alternatively, correct the doc to describe the clipboard.
- `notifications.md` describes email-less contacts as a supported Telegram-only path; the app blocks it (B-08).
- Docs write router paths as `routers/*.py`; they live at `modules/routers/*.py`.

## Good practices

### U-22 — Replace the placeholder response bodies — `backend`
`{"Skellent": "Success!"}` is the contract for three creation endpoints (B-16). Return the created resource, or at minimum its id. Safe to change: `register.js` discards the body entirely.

### U-23 — Structured logging with a request id — `backend`
With a shared connection and background tasks interleaving, correlating "which request produced this error" is guesswork. A middleware-assigned request id in every log line fixes it cheaply.

### U-24 — Cache `get_credentials()` — `backend`
`@lru_cache`, with `load_dotenv` called once at startup. Removes the per-call disk read and the inconsistency where some modules snapshot config and others re-read it (B-18).

### U-25 — CI pipeline — repo
GitHub Actions running `ruff`, the U-15 suite, and `bun run build` with a check that `www/` has no uncommitted diff afterward.

That last check is the direct fix for **B-05** — a stale bundle shipping because someone edited `src/` and forgot to rebuild. That already happened once, and given `www/js/main.js` is committed and served live, it will happen again without a guard.

### U-27 — Type checking — repo
Type hints are already used consistently, which is most of the work. Running `mypy` or `pyright` in CI turns them from documentation into a check — it would have flagged `int(os.getenv("PORT"))` (B-17) as `str | None` passed to `int`.

---

# Part 2 — App binary rebuild required

### U-12 — Give the app an offline state
**Needs:** `capacitor.config.js` (`server.errorPath`) + a bundled `offline.html` → `bunx cap sync` → `./gradlew assembleRelease` → redistribute APK

**Deferred until the Google Play deployment.** Implemented and reverted on 2026-08-17; notes kept here so it can be redone quickly.

Today, no network means a blank WebView with no explanation: `server.url` points at the backend and there is no bundled fallback.

**Why this cannot avoid a binary rebuild.** The condition being handled is "the backend is unreachable," so the fallback cannot be served by the backend — a page can't cover its own absence. The HTTP cache doesn't rescue it either: `/app` is served `Cache-Control: no-cache`, which forces revalidation, and revalidation fails offline; on first install nothing is cached at all. Capacitor resolves `errorPath` to `capacitor://localhost/offline.html` — the local bundled assets. Both the flag and the page live inside the APK.

**Implementation notes, verified against Capacitor 8.5.0:**
- `server.errorPath` is supported on **both** platforms (`Bridge.java:548`, `BridgeWebViewClient.java:55/85`; `CAPInstanceConfiguration.swift:18`, `WebViewDelegationHandler.swift:139/150`). It fires on network failure *and* on HTTP errors, main frame only.
- The offline page **must call `SplashScreen.hide()`** through the Capacitor bridge. With `launchAutoHide: false`, `main.js` is the only caller and it never runs on a failed load — without this the user stares at the splash instead of the offline page. Both `SplashScreen` and `Preferences` are registered natively, so the bridge is available on the bundled page.
- Bake `API_BASE_URL` into the page at build time (a `build.js` step, mirroring how `main.js` gets it) so the retry button knows where to navigate back to.
- Read `panicbutton.theme` and `panicbutton.lang` via the `Preferences` bridge so the page respects settings the user already chose.

**The no-binary alternative, honestly:** a service worker on the backend origin, precaching the app shell. It ships through `www/`. I'd still recommend `errorPath` — a service worker can't help on first launch (nothing installed until after a successful load), Android WebView SW behaviour is inconsistent, and it doesn't fix the splash hang. **U-10 does fix the splash hang and needs no binary** — that is the useful part to ship in the meantime.

**Perspective:** an offline app can't send a panic alert anyway. This isn't restoring functionality; it's replacing a blank screen with an explanation and a retry.

### U-26 — Pin and audit dependencies — repo, **conditionally binary**
`uv.lock` and `bun.lock` are committed, which is right. Add `pip-audit` / `bun audit` to CI so known CVEs surface on their own.

Listed here because of what acting on a finding costs: a `passlib` or `pyjwt` advisory is a backend redeploy, but **bumping any `@capacitor/*` or `@capacitor-community/*` package changes native code and requires a new APK.** Worth batching those bumps with a planned store release rather than taking them ad hoc.
