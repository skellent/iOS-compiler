# `modules/routers/features.py`

## Purpose

A single endpoint, `GET /features`, that tells the app which optional backend integrations are actually usable in the environment it's talking to:

```python
from fastapi import APIRouter

from modules.credentials import get_credentials

router = APIRouter(prefix="/features", tags=["features"])

_credentials: dict = get_credentials()


@router.get("")
def get_features():
    return {
        "telegram": bool(_credentials['telegram']['bot_token']) and bool(_credentials['telegram']['bot_username']),
    }
```

## Why this exists

Telegram (see `telegram.md`) is entirely optional: without `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME` set, the backend boots normally and just never registers a webhook or sends Telegram messages. That's the right behavior for the *server*, but the app had no way to know it — `POST /contacts/{id}/telegram/enable` doesn't check whether a bot is actually configured before responding `200` and building a `https://t.me/{bot_username}?start={token}` link. With no `bot_username` set, that link comes out as `https://t.me/None?start=...` — broken, and if the contact has an email on file, mailed straight to them. The app's "Connect Telegram" button, until now, had no way to avoid offering a feature that doesn't work in that deployment.

`GET /features` is the app's way of asking "what should I actually show". It's deliberately not folded into an existing router (`contacts.py` is about a specific contact, not deployment-wide capabilities), and deliberately shaped as a flat `{feature_name: bool}` map instead of one endpoint per feature, so a future feature (SMS via Twilio, see `main.md`'s "What's still missing") is one more key in this same dict, not a new route the app has to learn about separately.

## Why it checks both `bot_token` and `bot_username`, not just one

`telegram.py`'s own webhook and `Telegram.Send`/`SendBulk` only need `bot_token` to talk to the Bot API. But the *link a contact needs to press* is built from `bot_username` (`POST /contacts/{id}/telegram/enable`, see `routers.md`) — a deployment that only sets one of the two still can't complete the linking flow. `get_features` reports `telegram: false` unless both are set, matching what "the feature actually works end to end" means, not just "the bot can send messages".

## Why no auth (`Depends(current_user)`)

Unlike `/contacts` or `/alerts`, this isn't user data — it's a fact about the deployment itself, the same for every caller. Requiring a session token here would only get in the way of the one thing this endpoint is for: letting the app decide what to render, as early as it wants to (before login, if it chooses), without an extra round trip once a user's session is available.

## Relationship with the rest of the backend

`modules/routers/features.py` only depends on `modules/credentials.py` — it doesn't touch `modules/db.py`/`cursor.py` at all, since nothing here is per-user or per-row. The app is expected to call this once (e.g. on startup, or whenever it renders the Contacts screen) and use the result to decide whether to render Telegram's connect/disconnect UI at all, rather than rendering it and letting `POST /contacts/{id}/telegram/enable` fail or silently produce a broken link.
