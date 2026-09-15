"""Account linking for user-owned Drive recordings and TikTok video posts."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from modules.cursor import Queries
from modules.db import cursor
from modules.dependencies import current_user
from modules.logs import get_logger
from modules.social_video import (VideoProviderError, authorize_url, connection,
                                  exchange_code, provider_enabled, save_connection,
                                  tiktok_creator_info)
from modules.token import Token

router = APIRouter(prefix="/integrations", tags=["integrations"])
_logger = get_logger(__name__)
_PROVIDERS = ("google", "tiktok")


@router.get("")
def statuses(user_id: int = Depends(current_user)):
    result = {}
    for provider in _PROVIDERS:
        available = provider_enabled(provider)
        try:
            connected = bool(connection(provider, user_id)) if available else False
        except VideoProviderError:
            connected = False
        result[provider] = {"available": available, "connected": connected}
    return result


@router.get("/tiktok/recording-limit")
async def tiktok_recording_limit(user_id: int = Depends(current_user)):
    try:
        info = await tiktok_creator_info(user_id)
        return {"max_duration_seconds": info["max_duration_seconds"]}
    except VideoProviderError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{provider}/authorize")
def start_authorization(provider: str, user_id: int = Depends(current_user)):
    if provider not in _PROVIDERS or not provider_enabled(provider):
        raise HTTPException(status_code=503, detail=f"{provider} integration is not configured")
    state = Token.CreateSocialOauthState(provider, user_id)
    return {"authorize_url": authorize_url(provider, state)}


def _callback_result(provider: str, success: bool) -> HTMLResponse:
    name = "Google Drive" if provider == "google" else "TikTok"
    title = f"{name} connected" if success else f"Could not connect {name}"
    message = "Return to Panic Button and refresh your connections." if success else "Return to Panic Button and try again."
    return HTMLResponse(
        f"<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
        f"<title>{title}</title></head><body><main><h1>{title}</h1><p>{message}</p></main></body></html>",
        status_code=200 if success else 400,
        headers={"Cache-Control": "no-store"},
    )


@router.get("/{provider}/callback", response_class=HTMLResponse)
async def authorization_callback(provider: str, state: str = "", code: str = "", error: str = ""):
    user_id = Token.ValidateSocialOauthState(state, provider) if provider in _PROVIDERS else None
    if not user_id or error or not code:
        return _callback_result(provider, False)
    if not cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,)):
        return _callback_result(provider, False)
    try:
        token = await exchange_code(provider, code)
        if provider == "tiktok" and "video.publish" not in token.get("scope", ""):
            raise VideoProviderError("TikTok video.publish permission was not granted")
        if provider == "google" and token.get("scope") and "https://www.googleapis.com/auth/drive.file" not in token["scope"]:
            raise VideoProviderError("Google Drive file permission was not granted")
        save_connection(provider, user_id, token)
    except VideoProviderError as exc:
        _logger.warning(f"{provider} OAuth for user {user_id} failed: {exc}")
        return _callback_result(provider, False)
    return _callback_result(provider, True)


@router.delete("/{provider}")
def disconnect(provider: str, user_id: int = Depends(current_user)):
    if provider not in _PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")
    cursor.execute(Queries.DELETE_SOCIAL_CONNECTION, (user_id, provider))
    cursor.commit()
    return {"disconnected": True}
