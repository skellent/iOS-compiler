"""User-authorized Drive and TikTok API operations for SOS recordings."""

from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode, urlparse

import httpx
from cryptography.fernet import Fernet, InvalidToken

from modules.credentials import get_credentials
from modules.cursor import Queries
from modules.db import cursor
from modules.token import Token


_CONFIG = get_credentials()["video"]
_BASE = get_credentials()["api_base_url"]
_GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.file"
_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


class VideoProviderError(RuntimeError):
    pass


def provider_enabled(provider: str) -> bool:
    if not _CONFIG["token_key"] or not _BASE.startswith("https://"):
        return False
    try:
        _fernet()
    except VideoProviderError:
        return False
    if provider == "google":
        return bool(_CONFIG["google_client_id"] and _CONFIG["google_client_secret"])
    if provider == "tiktok":
        return bool(_CONFIG["tiktok_client_key"] and _CONFIG["tiktok_client_secret"])
    return False


def _fernet() -> Fernet:
    try:
        return Fernet(_CONFIG["token_key"].encode())
    except (ValueError, TypeError) as exc:
        raise VideoProviderError("SOCIAL_TOKEN_KEY is missing or invalid") from exc


def _seal(value: str | None) -> str | None:
    return _fernet().encrypt(value.encode()).decode() if value else None


def _open(value: str | None) -> str | None:
    try:
        return _fernet().decrypt(value.encode()).decode() if value else None
    except InvalidToken as exc:
        raise VideoProviderError("Stored account authorization is unreadable; reconnect this account") from exc


def connection(provider: str, user_id: int) -> dict | None:
    rows = cursor.execute(Queries.SELECT_SOCIAL_CONNECTION, (user_id, provider))
    if not rows:
        return None
    row = dict(rows[0])
    row["access_token"] = _open(row["access_token"])
    row["refresh_token"] = _open(row["refresh_token"])
    return row


def save_connection(provider: str, user_id: int, token: dict) -> None:
    try:
        old = connection(provider, user_id)
    except VideoProviderError:
        old = None
    refresh = token.get("refresh_token") or (old or {}).get("refresh_token")
    expires = datetime.now(timezone.utc) + timedelta(seconds=int(token.get("expires_in", 3600)))
    cursor.execute(Queries.UPSERT_SOCIAL_CONNECTION, (
        user_id, provider, _seal(token["access_token"]), _seal(refresh),
        expires.replace(tzinfo=None), token.get("scope", ""),
    ))
    cursor.commit()


def authorize_url(provider: str, state: str) -> str:
    if provider == "google":
        params = {
            "client_id": _CONFIG["google_client_id"],
            "redirect_uri": f"{_BASE}/integrations/google/callback",
            "response_type": "code", "scope": _GOOGLE_SCOPE,
            "access_type": "offline", "prompt": "consent", "state": state,
        }
        return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    if provider == "tiktok":
        params = {
            "client_key": _CONFIG["tiktok_client_key"],
            "redirect_uri": f"{_BASE}/integrations/tiktok/callback",
            "response_type": "code", "scope": "user.info.basic,video.publish", "state": state,
        }
        return "https://www.tiktok.com/v2/auth/authorize/?" + urlencode(params)
    raise VideoProviderError("Unknown provider")


async def exchange_code(provider: str, code: str) -> dict:
    if provider == "google":
        url = "https://oauth2.googleapis.com/token"
        data = {
            "client_id": _CONFIG["google_client_id"],
            "client_secret": _CONFIG["google_client_secret"],
            "code": code, "grant_type": "authorization_code",
            "redirect_uri": f"{_BASE}/integrations/google/callback",
        }
    elif provider == "tiktok":
        url = "https://open.tiktokapis.com/v2/oauth/token/"
        data = {
            "client_key": _CONFIG["tiktok_client_key"],
            "client_secret": _CONFIG["tiktok_client_secret"],
            "code": code, "grant_type": "authorization_code",
            "redirect_uri": f"{_BASE}/integrations/tiktok/callback",
        }
    else:
        raise VideoProviderError("Unknown provider")
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(url, data=data)
    except httpx.HTTPError as exc:
        raise VideoProviderError(f"{provider} authorization service is unreachable") from exc
    if response.is_error:
        raise VideoProviderError(f"{provider} authorization failed ({response.status_code})")
    token = response.json()
    if not token.get("access_token"):
        raise VideoProviderError(f"{provider} did not provide an access token")
    return token


async def access_token(provider: str, user_id: int) -> str:
    saved = connection(provider, user_id)
    if not saved:
        raise VideoProviderError(f"Connect {provider} before using this feature")
    expiry = saved["expires_at"].replace(tzinfo=timezone.utc)
    if expiry > datetime.now(timezone.utc) + timedelta(minutes=2):
        return saved["access_token"]
    if not saved["refresh_token"]:
        raise VideoProviderError(f"Reconnect {provider}; its authorization expired")
    if provider == "google":
        url = "https://oauth2.googleapis.com/token"
        data = {
            "client_id": _CONFIG["google_client_id"],
            "client_secret": _CONFIG["google_client_secret"],
            "refresh_token": saved["refresh_token"], "grant_type": "refresh_token",
        }
    else:
        url = "https://open.tiktokapis.com/v2/oauth/token/"
        data = {
            "client_key": _CONFIG["tiktok_client_key"],
            "client_secret": _CONFIG["tiktok_client_secret"],
            "refresh_token": saved["refresh_token"], "grant_type": "refresh_token",
        }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(url, data=data)
    except httpx.HTTPError as exc:
        raise VideoProviderError(f"{provider} token service is unreachable") from exc
    if response.is_error or not response.json().get("access_token"):
        raise VideoProviderError(f"Reconnect {provider}; its authorization expired")
    token = response.json()
    if "refresh_token" not in token:
        token["refresh_token"] = saved["refresh_token"]
    save_connection(provider, user_id, token)
    return token["access_token"]


def _google_upload_url(location: str) -> str:
    parsed = urlparse(location)
    if parsed.scheme != "https" or parsed.hostname != "www.googleapis.com" or not parsed.path.startswith("/upload/drive/v3/files"):
        raise VideoProviderError("Google returned an unexpected upload endpoint")
    return location


async def upload_to_drive(user_id: int, path: Path, mime_type: str, name: str) -> tuple[str, str]:
    token = await access_token("google", user_id)
    size = path.stat().st_size
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=10.0)) as client:
        start = await client.post(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink",
            headers={**headers, "Content-Type": "application/json", "X-Upload-Content-Type": mime_type,
                     "X-Upload-Content-Length": str(size)},
            json={"name": name, "mimeType": mime_type},
        )
        if start.is_error or "location" not in start.headers:
            raise VideoProviderError(f"Google Drive upload could not start ({start.status_code})")
        upload_url = _google_upload_url(start.headers["location"])

        async def file_chunks():
            with path.open("rb") as source:
                while chunk := source.read(1024 * 1024):
                    yield chunk

        uploaded = await client.put(upload_url, headers={"Content-Type": mime_type,
                                                          "Content-Length": str(size)}, content=file_chunks())
        if uploaded.is_error:
            raise VideoProviderError(f"Google Drive upload failed ({uploaded.status_code})")
        file_id = uploaded.json().get("id")
        if not file_id:
            raise VideoProviderError("Google Drive did not return a file ID")
        shared = await client.post(
            f"https://www.googleapis.com/drive/v3/files/{file_id}/permissions",
            headers={**headers, "Content-Type": "application/json"},
            json={"type": "anyone", "role": "reader", "allowFileDiscovery": False},
        )
        if shared.is_error:
            raise VideoProviderError(f"Video reached Drive, but public sharing failed ({shared.status_code})")
        metadata = await client.get(f"https://www.googleapis.com/drive/v3/files/{file_id}?fields=webViewLink",
                                    headers=headers)
        url = metadata.json().get("webViewLink") if not metadata.is_error else None
        return file_id, url or f"https://drive.google.com/file/d/{file_id}/view"


async def tiktok_creator_info(user_id: int) -> dict:
    token = await access_token("tiktok", user_id)
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post("https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
                                         headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    except httpx.HTTPError as exc:
        raise VideoProviderError("TikTok posting options are unreachable") from exc
    result = response.json() if not response.is_error else {}
    if response.is_error or result.get("error", {}).get("code") != "ok":
        raise VideoProviderError("TikTok could not provide posting options for this account")
    info = result["data"]
    return {"username": info.get("creator_username", ""), "nickname": info.get("creator_nickname", ""),
            "privacy_options": info.get("privacy_level_options", []),
            "max_duration_seconds": info.get("max_video_post_duration_sec", 0),
            "comment_disabled": info.get("comment_disabled", False),
            "duet_disabled": info.get("duet_disabled", False),
            "stitch_disabled": info.get("stitch_disabled", False)}


async def post_to_tiktok(user_id: int, video: dict, privacy: str, title: str,
                         allow_comment: bool, allow_duet: bool, allow_stitch: bool,
                         brand_organic: bool, brand_content: bool) -> str:
    token = await access_token("tiktok", user_id)
    pull_token = Token.CreateTikTokVideoPull(video["alert_id"], user_id)
    video_url = f"{_BASE}/videos/tiktok/{pull_token}"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            started = await client.post(
                "https://open.tiktokapis.com/v2/post/publish/video/init/",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"post_info": {"title": title, "privacy_level": privacy,
                                    "disable_comment": not allow_comment, "disable_duet": not allow_duet,
                                    "disable_stitch": not allow_stitch,
                                    "brand_organic_toggle": brand_organic,
                                    "brand_content_toggle": brand_content},
                      "source_info": {"source": "PULL_FROM_URL", "video_url": video_url}},
            )
    except httpx.HTTPError as exc:
        raise VideoProviderError("TikTok posting service is unreachable") from exc
    result = started.json() if not started.is_error else {}
    if started.is_error or result.get("error", {}).get("code") != "ok":
        raise VideoProviderError(result.get("error", {}).get("message") or "TikTok rejected this post")
    return result["data"]["publish_id"]


async def tiktok_post_status(user_id: int, publish_id: str) -> dict:
    token = await access_token("tiktok", user_id)
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post("https://open.tiktokapis.com/v2/post/publish/status/fetch/",
                                         headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                                         json={"publish_id": publish_id})
    except httpx.HTTPError as exc:
        raise VideoProviderError("TikTok post status is unreachable") from exc
    result = response.json() if not response.is_error else {}
    if response.is_error or result.get("error", {}).get("code") != "ok":
        raise VideoProviderError("TikTok post status is unavailable")
    data = result.get("data", {})
    return {"status": data.get("status", "PROCESSING"),
            "fail_reason": data.get("fail_reason")}
