"""Stream SOS recordings directly to the user's Google Drive."""

import re
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from modules.credentials import get_credentials
from modules.cursor import Queries
from modules.db import cursor
from modules.dependencies import current_user
from modules.google_drive import DriveError, connection, upload_stream
from modules.logs import get_logger

router = APIRouter(prefix="/alerts", tags=["alert videos"])
_logger = get_logger(__name__)
_MAX_BYTES = 100 * 1024 * 1024
_EXTENSIONS = {"video/webm": "webm", "video/mp4": "mp4"}
_RECORD_SECONDS = get_credentials()["video"]["record_seconds"]


def _owned_alert(alert_id: int, user_id: int) -> None:
    if not cursor.execute(Queries.SELECT_ALERT_ID_BY_USER, (alert_id, user_id)):
        raise HTTPException(status_code=404, detail="Alert not found")


def _video(alert_id: int) -> dict | None:
    rows = cursor.execute(Queries.SELECT_ALERT_VIDEO, (alert_id,))
    if not rows:
        return None
    video = rows[0]
    started = video.get("drive_started_at")
    if (video["drive_status"] == "uploading" and started and
            started < datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=30)):
        cursor.execute(Queries.MARK_ALERT_VIDEO_FAILED, (alert_id,))
        cursor.commit()
        video["drive_status"] = "failed"
        video["drive_started_at"] = None
    return video


def video_public_status(alert_id: int) -> dict:
    video = _video(alert_id)
    if not video:
        return {"status": "not_recorded", "url": None, "preview_url": None}
    ready = video["drive_status"] == "ready"
    file_id = video.get("drive_file_id") if ready else None
    preview_url = (f"https://drive.google.com/file/d/{file_id}/preview"
                   if file_id and re.fullmatch(r"[A-Za-z0-9_-]+", file_id) else None)
    if preview_url and video.get("drive_url"):
        resource_key = parse_qs(urlsplit(video["drive_url"]).query).get("resourcekey", [None])[0]
        if resource_key and re.fullmatch(r"[A-Za-z0-9_-]+", resource_key):
            preview_url += f"?resourcekey={resource_key}"
    return {"status": video["drive_status"],
            "url": video["drive_url"] if ready else None,
            "preview_url": preview_url}


@router.post("/{alert_id}/video", status_code=201)
async def upload_video_to_drive(
    alert_id: int,
    request: Request,
    x_video_duration: int = Header(...),
    x_video_size: int = Header(...),
    user_id: int = Depends(current_user),
):
    """Relay the raw request body to Drive; no recording is written to backend disk."""
    _owned_alert(alert_id, user_id)
    existing = _video(alert_id)
    if existing and existing["drive_status"] in ("uploading", "ready"):
        raise HTTPException(status_code=409, detail="This alert video is already uploading or available")
    if not 1 <= x_video_duration <= _RECORD_SECONDS + 2:
        raise HTTPException(status_code=422, detail="Recording duration exceeds the configured limit")
    mime_type = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if mime_type not in _EXTENSIONS:
        raise HTTPException(status_code=415, detail="Video must be WebM or MP4")
    byte_size = x_video_size
    if byte_size < 1:
        raise HTTPException(status_code=422, detail="Recording is empty")
    if byte_size > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Recording exceeds the 100 MB upload limit")
    try:
        if not connection(user_id):
            raise HTTPException(status_code=409, detail="Connect Google Drive before recording an SOS video")
    except DriveError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    cursor.execute(Queries.START_ALERT_VIDEO_DRIVE_UPLOAD, (alert_id, x_video_duration))
    cursor.commit()
    try:
        file_id, url = await upload_stream(
            user_id, request.stream(), mime_type, byte_size,
            f"PanicButton-alert-{alert_id}.{_EXTENSIONS[mime_type]}",
        )
        cursor.execute(Queries.MARK_ALERT_VIDEO_READY, (file_id, url, alert_id))
        cursor.commit()
    except DriveError as exc:
        cursor.execute(Queries.MARK_ALERT_VIDEO_FAILED, (alert_id,))
        cursor.commit()
        _logger.error(f"Alert {alert_id} Drive upload failed: {exc}")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception:
        cursor.execute(Queries.MARK_ALERT_VIDEO_FAILED, (alert_id,))
        cursor.commit()
        raise
    return {"status": "ready", "drive_status": "ready", "url": url,
            "duration_seconds": x_video_duration}


@router.get("/{alert_id}/video")
def owner_video_status(alert_id: int, user_id: int = Depends(current_user)):
    _owned_alert(alert_id, user_id)
    video = _video(alert_id)
    if not video:
        return {"status": "not_recorded", "drive_status": "not_uploaded", "url": None}
    return {"status": "ready" if video["drive_status"] == "ready" else video["drive_status"],
            "drive_status": video["drive_status"],
            "url": video["drive_url"] if video["drive_status"] == "ready" else None,
            "duration_seconds": video["duration_seconds"]}
