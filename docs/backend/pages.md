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

## `templates/web/confirmation_result.html.j2`

Covers every outcome of `GET /contacts/confirm/{token}` and the failure outcomes of `GET /auth/confirm/{token}` — the `success` boolean and the `message` string in the context decide the icon (a checkmark or an X, drawn as inline SVG) and the body copy, instead of maintaining several near-identical HTML files. This page isn't constrained by email-client rendering quirks (see `mail.md`'s note on why those use table layouts) — it's a normal page opened in a real browser, so it uses plain modern CSS (flexbox centering, a solid brand-color background, an inline favicon as a base64 `data:` URI) with no external stylesheets, fonts, or images: the whole page is self-contained in one file, so it never depends on a third-party host being reachable.

The icon plays a short entrance animation on load — the circle it sits in scales in with a slight overshoot, and the check or X strokes draw themselves in right after (`stroke-dasharray`/`stroke-dashoffset`, the same drawing technique the app's own panic-button success state uses, see `docs/app/screens.md`) — a small, deliberate "confirmed" moment instead of the page simply appearing fully formed. It shares the same brand color as the email templates (see `mail.md`'s color table), so the visual identity is consistent from the moment the email arrives to the moment the link is clicked.

## `templates/web/app_redirect.html.j2`

The page `GET /auth/confirm/{token}` renders once a new account is successfully confirmed (see `routers.md`), instead of `confirmation_result.html.j2` — a newly confirmed user still has to log in, so the useful next step isn't a static "you're confirmed" message but getting them back into the app to do that. It receives a single `deep_link` value in its context (the `panicswitch://` URL from `credentials.md`'s `app_deep_link`) and tries to leave the browser immediately: a `<meta http-equiv="refresh">` tag and a `window.location.replace(...)` call both fire on load, redundantly, because mobile browsers and in-app email-client webviews are inconsistent about which redirect mechanisms they honor. A visible "Open Panic Switch" button links to the same `deep_link` as a manual fallback, for the case where both automatic attempts are blocked. Like `confirmation_result.html.j2`, its success icon plays the same scale-and-draw entrance animation, and it embeds the same inline favicon.

## Relationship with the rest of the backend

`modules/routers/auth.py` and `modules/routers/contacts.py` are the only importers of `Pages`, to render their respective `confirm/{token}` responses (see `routers.md`). `pages.py` has no dependency on `modules/cursor.py`, `modules/token.py` or any other backend module — it only knows how to turn a template name and a context dict into an HTML string.
