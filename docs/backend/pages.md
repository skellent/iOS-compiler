# `modules/pages.py`

## Purpose

```python
class Pages:
    @staticmethod
    def Render(template: str, context: dict) -> str:
        ...
```

Every JSON endpoint in the API answers a client that expects `application/json` — the future Capacitor app, `curl`, `requests`. `GET /contacts/confirm/{token}` and `GET /auth/confirm/{token}` (see `routers.md`, `mail.md`) are different: both are reached by a person clicking a link inside an email, landing directly in a browser tab, not by an API client parsing a response. Answering that click with raw JSON on a blank page reads as broken to a non-technical person, even though the request technically succeeded. `Pages.Render` exists to produce a real HTML page for those cases instead.

## Why a separate module instead of reusing `modules/mail.py`'s Jinja environment

`mail.py` already has a `Jinja2Environment` pointed at `templates/mail/` (see `mail.md`), but it's aimed at building `EmailMessage` objects meant to be sent over SMTP — not at producing a string to hand back as an HTTP response. Rather than overload that environment with a second, unrelated purpose, `pages.py` sets up its own `Environment`, pointed at a sibling folder, `templates/web/`, that holds pages meant to be *served*, not *sent*:

```python
_jinja_env: Environment = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parent.parent / "templates" / "web"),
    autoescape=select_autoescape(["html", "xml"]),
)
```

This mirrors the same rationale already applied to `mail.py` and `cursor.py` (see their own docs): each file that owns a distinct kind of output (SQL, outgoing email, served HTML) keeps its own environment/connection instead of a shared one juggling multiple unrelated jobs. `autoescape` is on for the same reason as in `mail.py` — nothing interpolated into these templates today comes from user input, but there's no reason to leave the door open to an unescaped injection if a future template ever does.

## Why it returns a `str` instead of a `Response` itself

```python
return HTMLResponse(Pages.Render("confirmation_result", {"success": True, "message": "..."}))
```

`Pages.Render` only renders — it doesn't know or care about status codes, headers, or which endpoint is calling it. Wrapping the returned string in `fastapi.responses.HTMLResponse` (with whatever `status_code` fits the situation: `200`, `401`, `404`) is left to the router, the same separation of concerns `mail.py` keeps between building a message and actually sending it.

## CSS/JS/favicon live under `backend/static/`, not inline

All three pages below link a stylesheet (`/static/css/<page>.css`) and, for `dashboard.html.j2`, a script (`/static/js/dashboard.js`) instead of carrying `<style>`/`<script>` blocks themselves, and share one favicon (`/static/img/favicon.png`) instead of each repeating the same base64 `data:` URI. `main.py` mounts that directory with Starlette's `StaticFiles` — see `main.md`'s `/static` section for the mechanics and for why `confirmation_result.html.j2`'s icon color had to move from a Jinja-templated CSS value to a plain `.icon-success`/`.icon-error` class toggle to make the split possible. Nothing in this file changed: `Pages.Render` still just renders a template name plus a context dict, it has no idea the templates it renders now link out to `/static` instead of inlining everything.

## `templates/web/landing.html.j2`

`GET /` (see `main.md`) renders this with `{"contact_email": ...}` (see below) — it's the one page here nobody is ever routed to *by* the backend (unlike `confirmation_result.html.j2`, reached from an email link, or `dashboard.html.j2`, reached by following this very page's button); it's whatever's at the API's base URL when a person types or is given that URL directly. Before the app existed anywhere but the Play Store's future listing, this page's only job was to say what this is and offer a single "Open Dashboard" link. Now that a signed release build exists before a Play Store listing does (see the Android release-signing work), this is also the app's download page: a hero with a direct "Download APK" button (linking to `/static/downloads/panic-button.apk`, served the same way as this page's own CSS — a plain static file, not something `pages.py` or a router builds) next to a disabled "Google Play — Coming soon" button, a feature grid, a three-step setup summary, and a footer with a "Contact us" (`mailto:` to the same address the backend sends mail *as*, see below) and "About us" link (`https://keycodelogics.com/`, the client's own site — hardcoded, not configurable, since it isn't environment-specific the way an email address is) alongside the existing `/dashboard` link. Now unlike the original version of this page, it does use `localStorage`: a gear icon opens a settings dialog (Theme + Language), the same interaction pattern `dashboard.html.j2` already used, described below — but the page's core content still has to render even without JavaScript or a network request beyond the APK download itself.

`/static/downloads/` isn't committed — see `backend/.gitignore` — since a release APK is a build artifact regenerated from `app/android` (`./gradlew assembleRelease`), not source, the same reasoning that already kept `app/www/js/` and `.venv` out of git. A deployment has to copy the current release APK into `backend/static/downloads/panic-button.apk` itself; the landing page's download button assumes that file exists but doesn't fail loudly if it doesn't (a `404` from `/static`, not a broken page).

### `contact_email`: the one dynamic value on an otherwise static page

`main.py`'s `root()` and `modules/routers/dashboard.py`'s `dashboard()` both pass `{"contact_email": get_credentials()['email']['from']}` into the template — the same value `modules/mail.py` puts in the outgoing `From:` header (see `credentials.md`, `mail.md`), not a second, separately-maintained address. Reusing it here means the footer's "Contact us" `mailto:` link and the address a contact actually receives mail from can never drift apart — whoever configures `SMTP_FROM` for a deployment doesn't also have to remember to update these two templates.

### Theme + Language, and the icon: shared with `dashboard.html.j2`

Both `.brand-mark` elements on this page are now `<img src="/static/img/brand-mark.png">` — the same 192×192 PNG `app/www/assets/brand-mark.png` already used for the app's own auth screens — instead of a CSS `div` approximating the icon with a radial-gradient background and "SOS" text. `dashboard.html.j2` was switched the same way, for the same reason: both were a hand-drawn stand-in for the app's actual icon, and now that the release APK (linked from this very page) has a real one, there's no reason for the web pages to keep guessing at it.

The settings dialog's Theme select writes to `localStorage` under `panicbutton.site.theme` — deliberately the *same* key `dashboard.js` uses (see below), not a `landing`-scoped one, so a Light/Dark/Auto choice made on either page applies on both the next time either loads (same origin, so the browser already shares the storage — the two scripts just had to agree on a key name). Language is landing-only (`panicbutton.landing.lang`): `dashboard.html.j2` has no strings translated, only Theme/Color, so there's nothing for a shared language key to apply to yet.

## `templates/web/confirmation_result.html.j2`

Covers every outcome of `GET /contacts/confirm/{token}` and the failure outcomes of `GET /auth/confirm/{token}` — the `success` boolean and the `message` string in the context decide the icon (a checkmark or an X, drawn as inline SVG) and the body copy, instead of maintaining several near-identical HTML files. This page isn't constrained by email-client rendering quirks (see `mail.md`'s note on why those use table layouts) — it's a normal page opened in a real browser, so it uses plain modern CSS (flexbox centering, a solid brand-color background) with no external fonts or third-party assets.

The icon plays a short entrance animation on load — the circle it sits in scales in with a slight overshoot, and the check or X strokes draw themselves in right after (`stroke-dasharray`/`stroke-dashoffset`, the same drawing technique the app's own panic-button success state uses, see `docs/app/screens.md`) — a small, deliberate "confirmed" moment instead of the page simply appearing fully formed. It shares the same brand color as the email templates (see `mail.md`'s color table), so the visual identity is consistent from the moment the email arrives to the moment the link is clicked.

`GET /auth/confirm/{token}` (see `routers.md`) also renders this same template on success, telling the newly confirmed user to go open the app and log in — it used to render a dedicated `app_redirect.html.j2` instead, which tried to leave the browser automatically for a `panicswitch://` deep link. That template was removed: the app never registered itself as the handler for that custom URL scheme at the native (Android/iOS) level, so the automatic redirect had nothing to open on a real device, and the page's own manual "Open Panic Switch" fallback button was always the one actually doing anything. `confirmation_result.html.j2` covers this case just as well as it covers a contact confirmation — the person still has to log in with their password either way, so there's nothing left for a dedicated redirect page to usefully do.

## `templates/web/dashboard.html.j2`

Unlike every other page in this directory, `dashboard.html.j2` isn't the last step of a server-side flow — it's rendered with just `{"contact_email": ...}` (see `landing.html.j2`'s section above) and does all of its actual work client-side, in `/static/js/dashboard.js`. It's a small single-page app: a login form (`POST /auth/login`) followed by a fetch of `GET /alerts` (see `routers.md`), rendered into a list of alert cards, each showing when and where the alert fired and, per notified contact, whether they've opened the `map_url` sent to them (see `mail.md`, `telegram.md`, `token.md`). A small `.dash-footer` below the card (mailto contact + "About us") is the only other use of that context value — everything else on the page is static markup.

- **Why plain vanilla JS instead of extending the mobile app itself**: `app/` (the Capacitor app, see `docs/app/`) is built and installed on the alerting user's own phone — asking someone to install that same app just to check whether their contacts saw an alert would be backwards. The dashboard needed to be reachable from any browser, on any device, with nothing to install, which is exactly what a server-rendered page already is.
- **Why it reuses `POST /auth/login`/`GET /alerts` instead of dashboard-specific endpoints**: the same JWT session mechanism (`token.md`) and the same ownership scoping (`Depends(current_user)`, see `dependencies.md`) already exist and already return exactly the data this page needs — introducing a parallel API surface just for this one page would duplicate logic that's already correct. The token is kept in `sessionStorage`, not `localStorage`, so a session on a shared or public computer doesn't outlive the browser tab.
- **Visual identity**: unlike `confirmation_result.html.j2` (built for a single moment, opened once from an email) and the mail templates (`mail.md`), this is a page someone might keep open and return to, so it uses the same dark, "tech" aesthetic as the mobile app's own redesign (`docs/app/screens.md`) rather than the lighter card-on-brand-color look the confirmation/email pages share — a deliberate visual split between "a message that happened to render as a web page" and "a small web app in its own right."

### Settings: a gear icon opening a native `<dialog>`

Theme (Light/Dark/Auto) and accent color — the same two preferences `app/src/lib/theme.js` exposes on the Profile screen (see `docs/app/screens.md`) — are reachable here from a small gear button fixed to the top-right corner (`.settings-fab`), present on both the login card and the logged-in view, since neither preference is tied to being logged in (both persist in `localStorage`, not on the account, same as the app's `Preferences` plugin storage). Theme specifically is stored under `panicbutton.site.theme`, shared with `landing.html.j2`'s own settings dialog (see above) — the two pages were built independently but deliberately agree on this one key so the choice carries over between them; accent color (`panicbutton.dashboard.accentColor`) stays dashboard-only, since `landing.css` has no accent picker of its own. Clicking the gear calls the native `HTMLDialogElement.showModal()` on `#settings-dialog` instead of a hand-rolled overlay built from a positioned `<div>`: the browser handles centering, the backdrop (styled via `::backdrop`), focus trapping, and closing on `Escape` for free. The dialog's own close button is a `type="submit"` inside a `<form method="dialog">` — submitting that form closes the dialog natively too, so the only interaction actually wired up by hand in `dashboard.js` is opening it and closing it on a backdrop click.

`dashboard.js` derives the same `--primary-900`/`700`/`600`/`500`/`400` shades from a single chosen hex that `app/src/lib/theme.js` does — same HSL math, same `SHADE_LIGHTNESS` table — reimplemented here rather than shared, since this page has no build step (no bundler to import a shared module through) and the app's version depends on `@capacitor/preferences`, which doesn't exist in a plain browser tab. `dashboard.css`'s light-theme block follows the same `:root:not([data-theme="dark"]):not([data-theme="light"])` (auto, media-query-driven) plus `:root[data-theme="light"]` (forced) split as `app/www/css/styles.css` — see that file's own comment for why both are needed instead of just the media query.

## Relationship with the rest of the backend

`modules/routers/auth.py`, `modules/routers/contacts.py` and `modules/routers/alerts.py` all call `Pages.Render("confirmation_result", ...)` for their respective `confirm/{token}`/`view/{token}` responses (see `routers.md`); `modules/routers/dashboard.py` is the only caller of `Pages.Render("dashboard", {})`; `main.py`'s `root()` is the only caller of `Pages.Render("landing", {})` (see `main.md`). `pages.py` has no dependency on `modules/cursor.py`, `modules/token.py` or any other backend module — it only knows how to turn a template name and a context dict into an HTML string. It has no dependency on `/static` either (that's `main.py`'s `StaticFiles` mount, see `main.md`) — a template can link to `/static/whatever` without `pages.py` needing to know that path exists or serves anything.
