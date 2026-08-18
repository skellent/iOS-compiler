from fastapi import APIRouter

from modules.credentials     import get_credentials
from modules.routers.contacts import MAX_CONTACTS

router = APIRouter(prefix="/features", tags=["features"])

_credentials: dict = get_credentials()


@router.get("")
def get_features():
    return {
        "telegram": bool(_credentials['telegram']['bot_token']) and bool(_credentials['telegram']['bot_username']),
        # Served rather than hardcoded a second time in the app, so the client's
        # "add" button and the backend's cap can't drift apart.
        "max_contacts": MAX_CONTACTS,
    }
