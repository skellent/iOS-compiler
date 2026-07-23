# `modules/pages.py`

## Purpose

```python
class Pages:
    @staticmethod
    def Render(template: str, context: dict) -> str:
        ...
```

Every other endpoint in the API answers with JSON — that's what an API client (the future Capacitor app, `curl`, `requests`) expects, and it's what `HTTPException` and returning a `dict` both produce by default in FastAPI. `GET /contacts/confirm/{token}` (see `routers.md`, `mail.md`) is different: it's reached by a person clicking a link inside an email, landing directly in a browser tab, not by an API client parsing a response. Answering that click with `{"message": "Contact confirmed successfully"}` — raw JSON on a blank page — reads as broken to a non-technical person, even though the request technically succeeded. `Pages.Render` exists to produce a real HTML page for that one case instead.

## Why a separate module instead of reusing `modules/mail.py`'s Jinja environment

`mail.py` already has a `Jinja2Environment` pointed at `templates/mail/` (see `mail.md`), but it's aimed at building `EmailMessage` objects meant to be sent over SMTP — not at producing a string to hand back as an HTTP response. Rather than overload that environment with a second, unrelated purpose, `pages.py` sets up its own `Environment`, pointed at a sibling folder, `templates/web/`, that holds pages meant to be *served*, not *sent*:

```python
_jinja_env: Environment = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parent.parent / "templates" / "web"),
    autoescape=select_autoescape(["html", "xml"]),
)
```

This mirrors the same rationale already applied to `mail.py` and `cursor.py` (see their own docs): each file that owns a distinct kind of output (SQL, outgoing email, served HTML) keeps its own environment/connection instead of a shared one juggling multiple unrelated jobs. `autoescape` is on for the same reason as in `mail.py`: `confirmation_result.html.j2`'s only interpolated value today is a `message` string chosen by this codebase itself (not user input), but there's no reason to leave the door open to an unescaped injection if a future template ever does interpolate something a user typed.

## Why it returns a `str` instead of a `Response` itself

```python
return HTMLResponse(
    Pages.Render("confirmation_result", {"success": True, "message": "..."}),
)
```

`Pages.Render` only renders — it doesn't know or care about status codes, headers, or which endpoint is calling it. Wrapping the returned string in `fastapi.responses.HTMLResponse` (with whatever `status_code` fits the situation: `200`, `401`, `404`) is left to the router (`contacts.py`, see `routers.md`), the same separation of concerns `mail.py` keeps between building a message (`_build_message`) and actually sending it (`Mail.Send`).

## `templates/web/confirmation_result.html.j2`

A single template covers all three outcomes of `GET /contacts/confirm/{token}` (success, invalid/expired token, contact no longer exists) — the `success` boolean and the `message` string in the context decide the icon (✓ or ✕), the heading, and the body copy, instead of maintaining three near-identical HTML files. Unlike the email templates, this page isn't constrained by email-client rendering quirks (see `mail.md`'s note on why those use table layouts) — it's a normal page opened in a real browser, so it uses plain modern CSS (flexbox centering, a linear gradient background, an inline SVG icon) with no external stylesheets, fonts, or images: the whole page is self-contained in one file, same as the emails, so it never depends on a third-party host being reachable.

It shares the same red palette as the email templates (see `mail.md`'s color table) so the visual identity is consistent from the moment the email arrives to the moment the link is clicked.

## Relationship with the rest of the backend

Only `modules/routers/contacts.py` imports `Pages`, to render `GET /contacts/confirm/{token}`'s response (see `routers.md`). `pages.py` has no dependency on `modules/cursor.py`, `modules/token.py` or any other backend module — it only knows how to turn a template name and a context dict into an HTML string.
