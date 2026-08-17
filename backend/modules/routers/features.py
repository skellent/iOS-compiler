from fastapi import APIRouter

from modules.credentials import get_credentials

router = APIRouter(prefix="/features", tags=["features"])

_credentials: dict = get_credentials()


@router.get("")
def get_features():
    return {
        "telegram": bool(_credentials['telegram']['bot_token']) and bool(_credentials['telegram']['bot_username']),
    }
