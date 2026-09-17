"""Google OAuth and streaming uploads for user-owned SOS recordings."""

from collections.abc import AsyncIterable
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlparse

import httpx
from cryptography.fernet import Fernet, InvalidToken

from modules.credentials import get_credentials
from modules.cursor import Queries
from modules.db import cursor


_CONFIG = get_credentials()["video"]
_BASE = get_credentials()["api_base_url"]
_GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.file"
_TIMEOUT = httpx.Timeout(360.0, connect=10.0)


class DriveError(RuntimeError):
    pass


def enabled() -> bool:
    if not (_CONFIG["token_key"] and _CONFIG["google_client_id"] and
            _CONFIG["google_client_secret"] and _BASE.startswith("https://")):
        return False
    try:
        _fernet()
    except DriveError:
        return False
    return True


def _fernet() -> Fernet:
    try:
        return Fernet(_CONFIG["token_key"].encode())
    except (ValueError, TypeError) as exc:
        raise DriveError("GOOGLE_TOKEN_KEY is missing or invalid") from exc


def _seal(value: str | None) -> str | None:
    return _fernet().encrypt(value.encode()).decode() if value else None


def _open(value: str | None) -> str | None:
    try:
        return _fernet().decrypt(value.encode()).decode() if value else None
    except InvalidToken as exc:
        raise DriveError("Stored Google authorization is unreadable; reconnect Google Drive") from exc


def connection(user_id: int) -> dict | None:
    rows = cursor.execute(Queries.SELECT_SOCIAL_CONNECTION, (user_id, "google"))
    if not rows:
        return None
    row = dict(rows[0])
    row["access_token"] = _open(row["access_token"])
    row["refresh_token"] = _open(row["refresh_token"])
    return row


def save_connection(user_id: int, token: dict) -> None:
    try:
        old = connection(user_id)
    except DriveError:
        old = None
    refresh = token.get("refresh_token") or (old or {}).get("refresh_token")
    expires = datetime.now(timezone.utc) + timedelta(seconds=int(token.get("expires_in", 3600)))
    cursor.execute(Queries.UPSERT_SOCIAL_CONNECTION, (
        user_id, "google", _seal(token["access_token"]), _seal(refresh),
        expires.replace(tzinfo=None), token.get("scope", ""),
    ))
    cursor.commit()


def authorize_url(state: str) -> str:
    params = {
        "client_id": _CONFIG["google_client_id"],
        "redirect_uri": f"{_BASE}/integrations/google/callback",
        "response_type": "code",
        "scope": _GOOGLE_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)


async def exchange_code(code: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post("https://oauth2.googleapis.com/token", data={
                "client_id": _CONFIG["google_client_id"],
                "client_secret": _CONFIG["google_client_secret"],
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": f"{_BASE}/integrations/google/callback",
            })
    except httpx.HTTPError as exc:
        raise DriveError("Google authorization service is unreachable") from exc
    if response.is_error:
        raise DriveError(f"Google authorization failed ({response.status_code})")
    token = response.json()
    if not token.get("access_token"):
        raise DriveError("Google did not provide an access token")
    return token


async def access_token(user_id: int) -> str:
    saved = connection(user_id)
    if not saved:
        raise DriveError("Connect Google Drive before recording an SOS video")
    expiry = saved["expires_at"].replace(tzinfo=timezone.utc)
    if expiry > datetime.now(timezone.utc) + timedelta(minutes=2):
        return saved["access_token"]
    if not saved["refresh_token"]:
        raise DriveError("Reconnect Google Drive; its authorization expired")
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post("https://oauth2.googleapis.com/token", data={
                "client_id": _CONFIG["google_client_id"],
                "client_secret": _CONFIG["google_client_secret"],
                "refresh_token": saved["refresh_token"],
                "grant_type": "refresh_token",
            })
    except httpx.HTTPError as exc:
        raise DriveError("Google token service is unreachable") from exc
    if response.is_error or not response.json().get("access_token"):
        raise DriveError("Reconnect Google Drive; its authorization expired")
    token = response.json()
    token.setdefault("refresh_token", saved["refresh_token"])
    save_connection(user_id, token)
    return token["access_token"]


def _upload_url(location: str) -> str:
    parsed = urlparse(location)
    if (parsed.scheme != "https" or parsed.hostname != "www.googleapis.com" or
            not parsed.path.startswith("/upload/drive/v3/files")):
        raise DriveError("Google returned an unexpected upload endpoint")
    return location


async def upload_stream(user_id: int, chunks: AsyncIterable[bytes], mime_type: str,
                        byte_size: int, name: str) -> tuple[str, str]:
    """Relay request chunks to Drive without creating a backend video file."""
    token = await access_token(user_id)
    auth = {"Authorization": f"Bearer {token}"}
    file_id: str | None = None
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            start = await client.post(
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink",
                headers={**auth, "Content-Type": "application/json",
                         "X-Upload-Content-Type": mime_type,
                         "X-Upload-Content-Length": str(byte_size)},
                json={"name": name, "mimeType": mime_type},
            )
            if start.is_error or "location" not in start.headers:
                raise DriveError(f"Google Drive upload could not start ({start.status_code})")

            transferred = 0

            async def validated_chunks():
                nonlocal transferred
                async for chunk in chunks:
                    if not chunk:
                        continue
                    transferred += len(chunk)
                    if transferred > byte_size:
                        raise DriveError("Recording body exceeds its declared size")
                    yield chunk

            uploaded = await client.put(
                _upload_url(start.headers["location"]),
                headers={**auth, "Content-Type": mime_type, "Content-Length": str(byte_size)},
                content=validated_chunks(),
            )
            if transferred != byte_size:
                raise DriveError("Recording upload ended before all bytes were received")
            if uploaded.is_error:
                raise DriveError(f"Google Drive upload failed ({uploaded.status_code})")
            file_id = uploaded.json().get("id")
            if not file_id:
                raise DriveError("Google Drive did not return a file ID")

            shared = await client.post(
                f"https://www.googleapis.com/drive/v3/files/{file_id}/permissions",
                headers={**auth, "Content-Type": "application/json"},
                json={"type": "anyone", "role": "reader", "allowFileDiscovery": False},
            )
            if shared.is_error:
                raise DriveError(f"Video reached Drive, but public sharing failed ({shared.status_code})")
            metadata = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{file_id}?fields=webViewLink",
                headers=auth,
            )
            url = metadata.json().get("webViewLink") if not metadata.is_error else None
            return file_id, url or f"https://drive.google.com/file/d/{file_id}/view"
        except DriveError:
            if file_id:
                try:
                    await client.delete(f"https://www.googleapis.com/drive/v3/files/{file_id}", headers=auth)
                except httpx.HTTPError:
                    pass
            raise
        except httpx.HTTPError as exc:
            if file_id:
                try:
                    await client.delete(f"https://www.googleapis.com/drive/v3/files/{file_id}", headers=auth)
                except httpx.HTTPError:
                    pass
            raise DriveError("Google Drive upload service is unreachable") from exc
