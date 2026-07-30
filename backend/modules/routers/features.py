from fastapi import APIRouter

from modules.credentials import get_credentials

router = APIRouter(prefix="/features", tags=["features"])

_credentials: dict = get_credentials()


@router.get("")
def get_features():
    return {
        # Telegram only actually works once both a bot token (to talk to the
        # Bot API) and a bot username (to build the t.me deep link) are set —
        # see docs/backend/telegram.md. Either one missing means a contact
        # who tries to link Telegram gets a broken link, so this reports
        # "off" in that case too, not just when both are unset.
        "telegram": bool(_credentials['telegram']['bot_token']) and bool(_credentials['telegram']['bot_username']),
    }
