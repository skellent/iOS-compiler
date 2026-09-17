"""Google Drive account linking for automatic SOS video uploads."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from modules.cursor import Queries
from modules.db import cursor
from modules.dependencies import current_user
from modules.google_drive import (DriveError, authorize_url, connection, enabled,
                                  exchange_code, save_connection)
from modules.logs import get_logger
from modules.token import Token

router = APIRouter(prefix="/integrations", tags=["integrations"])
_logger = get_logger(__name__)


@router.get("")
def statuses(user_id: int = Depends(current_user)):
    available = enabled()
    try:
        connected = bool(connection(user_id)) if available else False
    except DriveError:
        connected = False
    return {"google": {"available": available, "connected": connected}}


@router.post("/google/authorize")
def start_authorization(user_id: int = Depends(current_user)):
    if not enabled():
        raise HTTPException(status_code=503, detail="Google Drive integration is not configured")
    state = Token.CreateSocialOauthState("google", user_id)
    return {"authorize_url": authorize_url(state)}


def _callback_result(success: bool) -> HTMLResponse:
    title = "Google Drive connected" if success else "Could not connect Google Drive"
    message = "Return to Panic Button and refresh your connection." if success else "Return to Panic Button and try again."
    return HTMLResponse(
        f"<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
        f"<title>{title}</title></head><body><main><h1>{title}</h1><p>{message}</p></main></body></html>",
        status_code=200 if success else 400,
        headers={"Cache-Control": "no-store"},
    )


@router.get("/google/callback", response_class=HTMLResponse)
async def authorization_callback(state: str = "", code: str = "", error: str = ""):
    user_id = Token.ValidateSocialOauthState(state, "google")
    if not user_id or error or not code:
        return _callback_result(False)
    if not cursor.execute(Queries.SELECT_USER_BY_ID, (user_id,)):
        return _callback_result(False)
    try:
        token = await exchange_code(code)
        if token.get("scope") and "https://www.googleapis.com/auth/drive.file" not in token["scope"]:
            raise DriveError("Google Drive file permission was not granted")
        save_connection(user_id, token)
    except DriveError as exc:
        _logger.warning(f"Google OAuth for user {user_id} failed: {exc}")
        return _callback_result(False)
    return _callback_result(True)


@router.delete("/google")
def disconnect(user_id: int = Depends(current_user)):
    cursor.execute(Queries.DELETE_SOCIAL_CONNECTION, (user_id, "google"))
    cursor.commit()
    return {"disconnected": True}
