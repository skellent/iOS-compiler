# Server-rendered web pages

Most of this backend answers JSON. Three routes answer a real browser instead — `Pages.Render` (`modules/pages.py`) is the small Jinja wrapper behind all of them:

```python
class Pages:
    Render(template: str, context: dict) -> str
```

It renders a template from `templates/web/` and returns a plain string; the calling router wraps it in `HTMLResponse` with whatever status code fits (`200`, `401`, `404`). `pages.py` has no idea what `/static` is or that anything links to it — that's purely `main.py`'s concern.

## The three pages

| Route | Template | Rendered by | When |
|---|---|---|---|
| `GET /` | `landing.html.j2` | `main.py`'s `root()` | Whoever opens the API's base URL directly |
| `GET /dashboard` | `dashboard.html.j2` | `routers/dashboard.py` | Following the landing page's "Open Dashboard" link |
| `GET /auth/confirm/{token}`, `GET /contacts/confirm/{token}`, `GET /alerts/view/{token}` (error cases) | `confirmation_result.html.j2` | the respective router | Someone clicking a link inside an email |

Both `landing` and `dashboard` are rendered with `{"contact_email": get_credentials()['email']['from']}` — the same address `mail.py` actually sends *from*, not a second hardcoded one, so the footer's "Contact us" link and the address a contact actually receives mail from can never drift apart.

## `landing.html.j2` — also the app's download page

Hero with a "Download APK" button (`/static/downloads/panic-button.apk`) next to a disabled "Google Play — coming soon" button, a feature grid, a setup summary, and a footer with "Contact us" (`mailto:`) and "About us" (`https://keycodelogics.com/`). A gear icon opens a Theme/Language settings dialog, backed by `localStorage` — but the page's core content renders fully without JavaScript.

`backend/static/downloads/panic-button.apk` is a build artifact — `./gradlew assembleRelease` in `app/android`, copied here by whoever deploys, same as `app/www` (see [`../app/architecture.md`](../app/architecture.md)). **Any change at the native Android level — a new Capacitor plugin, a manifest permission, a native dependency bump — needs this file regenerated and redeployed.** The live-reload mechanism described in `app/architecture.md` only covers `app/www` (HTML/CSS/JS); it can't reach code compiled into the installed binary, so a device that already has the app installed won't see a native-level change until it installs a new APK.

## `dashboard.html.j2` — a small client-side app

Unlike the other two, this one does its real work in the browser: `POST /auth/login` (token kept in `sessionStorage`, not `localStorage`, so it doesn't outlive the tab) followed by `GET /alerts`, rendered into alert cards showing when/where each alert fired and, per notified contact, whether they've opened their `map_url` yet. Reuses the same `/auth`/`/alerts` endpoints the mobile app uses — no dashboard-specific API surface.

## `confirmation_result.html.j2` — one template, every outcome

`{success: bool, message: str}` picks a checkmark or an X (inline SVG, with a small draw-in animation) and the body copy — covers account confirmation, contact confirmation, and alert-view failures without near-duplicate HTML files for each.

## Shared CSS/JS: theme, language, and the app's own icon

`landing` and `dashboard` both use `<img class="brand-mark" src="/static/img/brand-mark.png">` — the same PNG used for the app's own auth screens (`app/www/assets/brand-mark.png`), copied into `backend/static/img/` — instead of a CSS-drawn placeholder. Theme (Light/Dark/Auto) is stored under the *same* `localStorage` key on both pages (`panicbutton.site.theme`), so a choice made on either page applies on both the next time either loads. Language (`landing.js` only — the dashboard has no translated strings yet) is separate (`panicbutton.landing.lang`).

## `/static` vs `/app`

```python
app.mount("/static", StaticFiles(directory=BACKEND_DIR / "static"), name="static")
...
app.mount("/app", _NoCacheStaticFiles(directory=APP_WWW_DIR, html=True), name="app")
```

`/static` is this backend's *own* CSS/JS/images (`landing.css`, `dashboard.js`, `brand-mark.png`, the APK) — a plain `StaticFiles` mount, default caching, nothing special. `/app` is the mobile app's built UI (`app/www/`, described fully in [`../app/architecture.md`](../app/architecture.md)) — a different mount, with a different, deliberate caching policy:

```python
_LONG_CACHE_SUFFIXES = {".png", ".jpg", ".jpeg", ".svg", ".ico", ".webp"}

class _NoCacheStaticFiles(StaticFiles):
    def file_response(self, full_path, stat_result, scope, status_code=200):
        response = super().file_response(full_path, stat_result, scope, status_code)
        if Path(full_path).suffix in _LONG_CACHE_SUFFIXES:
            response.headers["Cache-Control"] = "public, max-age=604800"
        else:
            response.headers["Cache-Control"] = "no-cache"
        return response
```

`index.html`/CSS/JS get `Cache-Control: no-cache` — the WebView must revalidate with the server on every request (a cheap `304` when nothing changed) rather than silently serving a stale copy from disk, which would defeat `GET /app/manifest`'s whole purpose (see `app/architecture.md`'s update-check flow). Cosmetic images (favicon, brand mark) get a real week-long cache instead: a stale icon for a few days is harmless, and forcing every image through the same revalidate-on-every-request treatment was pure overhead — a `304` still costs a full round trip, and it showed up as needless request volume in production logs for something that almost never changes.

`GET /app/manifest` is registered before `app.mount("/app", ...)` — Starlette matches routes in registration order, so the exact path wins for that one URL before the mount ever sees it (see [`architecture.md`](architecture.md)).
