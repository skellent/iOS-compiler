"""SOS recording storage, optional Drive sharing, and consented TikTok posting."""

import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from modules.credentials import get_credentials
from modules.cursor import DuplicateRecordError, Queries
from modules.db import cursor
from modules.dependencies import current_user
from modules.logs import get_logger
from modules.social_video import (VideoProviderError, connection, post_to_tiktok,
                                  tiktok_creator_info, tiktok_post_status, upload_to_drive)
from modules.token import Token

router = APIRouter(prefix="/alerts", tags=["alert videos"])
pull_router = APIRouter(prefix="/videos", tags=["video delivery"])
_logger = get_logger(__name__)
_MAX_BYTES = 100 * 1024 * 1024
_EXTENSIONS = {"video/webm": "webm", "video/mp4": "mp4"}
_VIDEO_DIR = Path(__file__).resolve().parents[2] / "data" / "videos"
_RECORD_SECONDS = get_credentials()["video"]["record_seconds"]
_BASE = get_credentials()["api_base_url"]


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


def _stored_path(video: dict) -> Path:
    path = Path(video["local_path"])
    if path.parent != _VIDEO_DIR or not path.is_file():
        raise HTTPException(status_code=404, detail="Recording file is unavailable")
    return path


def video_public_status(alert_id: int) -> dict:
    video = _video(alert_id)
    if not video:
        return {"status": "not_recorded", "url": None}
    return {"status": video["drive_status"],
            "url": video["drive_url"] if video["drive_status"] == "ready" else None}


def _duration(path: Path) -> int | None:
    """Read actual duration when ffprobe is installed."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=10, check=True,
        )
        return max(1, round(float(result.stdout.strip())))
    except (FileNotFoundError, subprocess.SubprocessError, ValueError):
        return None


@router.post("/{alert_id}/video", status_code=201)
async def receive_video(alert_id: int, video: UploadFile = File(...),
                        duration_seconds: int = Form(...), user_id: int = Depends(current_user)):
    _owned_alert(alert_id, user_id)
    if _video(alert_id):
        raise HTTPException(status_code=409, detail="This alert already has a recording")
    if not 1 <= duration_seconds <= _RECORD_SECONDS + 2:
        raise HTTPException(status_code=422, detail="Recording duration exceeds the configured limit")
    mime_type = (video.content_type or "").split(";", 1)[0].strip().lower()
    if mime_type not in _EXTENSIONS:
        raise HTTPException(status_code=415, detail="Video must be WebM or MP4")
    _VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    size = 0
    with NamedTemporaryFile(dir=_VIDEO_DIR, suffix=f".{_EXTENSIONS[mime_type]}", delete=False) as output:
        path = Path(output.name)
        try:
            while chunk := await video.read(1024 * 1024):
                size += len(chunk)
                if size > _MAX_BYTES:
                    raise HTTPException(status_code=413, detail="Recording exceeds the 100 MB upload limit")
                output.write(chunk)
        except BaseException:
            path.unlink(missing_ok=True)
            raise
    if not size:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="Recording is empty")
    measured = _duration(path)
    if measured and measured > _RECORD_SECONDS + 2:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="Recording duration exceeds the configured limit")
    try:
        cursor.execute(Queries.INSERT_ALERT_VIDEO, (
            alert_id, mime_type, size, measured or duration_seconds, str(path),
        ))
        cursor.commit()
    except DuplicateRecordError:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=409, detail="This alert already has a recording")
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return {"status": "ready", "byte_size": size, "duration_seconds": measured or duration_seconds}


@router.get("/{alert_id}/video")
def owner_video_status(alert_id: int, user_id: int = Depends(current_user)):
    _owned_alert(alert_id, user_id)
    video = _video(alert_id)
    if not video:
        return {"status": "not_recorded", "drive_status": "not_uploaded", "url": None,
            "tiktok_status": None, "tiktok_fail_reason": None}
    return {"status": video["status"], "drive_status": video["drive_status"],
            "url": video["drive_url"] if video["drive_status"] == "ready" else None,
            "tiktok_status": video["tiktok_status"],
            "tiktok_fail_reason": video["tiktok_fail_reason"],
            "duration_seconds": video["duration_seconds"]}


async def _send_to_drive(alert_id: int, user_id: int) -> None:
    try:
        video = _video(alert_id)
        path = _stored_path(video)
        file_id, url = await upload_to_drive(
            user_id, path, video["mime_type"], f"PanicButton-alert-{alert_id}.{_EXTENSIONS[video['mime_type']]}",
        )
        cursor.execute(Queries.MARK_ALERT_VIDEO_READY, (file_id, url, alert_id))
        cursor.commit()
    except Exception as exc:
        cursor.execute(Queries.MARK_ALERT_VIDEO_FAILED, (alert_id,))
        cursor.commit()
        _logger.error(f"Alert {alert_id} Drive upload failed: {type(exc).__name__}: {exc}")


@router.post("/{alert_id}/video/drive", status_code=202)
def send_to_drive(alert_id: int, background_tasks: BackgroundTasks,
                  user_id: int = Depends(current_user)):
    _owned_alert(alert_id, user_id)
    video = _video(alert_id)
    if not video or video["status"] != "ready":
        raise HTTPException(status_code=409, detail="Record a video first")
    try:
        google_connected = bool(connection("google", user_id))
    except VideoProviderError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not google_connected:
        raise HTTPException(status_code=409, detail="Connect Google Drive first")
    if video["drive_status"] in ("uploading", "ready"):
        raise HTTPException(status_code=409, detail="This video is already going to Google Drive")
    _stored_path(video)
    cursor.execute(Queries.MARK_ALERT_VIDEO_DRIVE_UPLOADING, (alert_id,))
    cursor.commit()
    background_tasks.add_task(_send_to_drive, alert_id, user_id)
    return {"drive_status": "uploading"}


@router.get("/{alert_id}/video/tiktok/options")
async def posting_options(alert_id: int, user_id: int = Depends(current_user)):
    _owned_alert(alert_id, user_id)
    video = _video(alert_id)
    if not video or video["status"] != "ready":
        raise HTTPException(status_code=409, detail="Record a video first")
    _stored_path(video)
    try:
        info = await tiktok_creator_info(user_id)
    except VideoProviderError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if video["duration_seconds"] > info["max_duration_seconds"]:
        raise HTTPException(status_code=422, detail="This video exceeds this TikTok account's maximum post duration")
    info["preview_url"] = f"{_BASE}/videos/preview/{Token.CreateVideoPreview(alert_id, user_id)}"
    return info


class TikTokPostRequest(BaseModel):
    title: str = Field(min_length=1, max_length=2200)
    privacy_level: str
    allow_comment: bool = False
    allow_duet: bool = False
    allow_stitch: bool = False
    brand_organic: bool = False
    brand_content: bool = False
    consent: bool


@router.post("/{alert_id}/video/tiktok", status_code=202)
async def publish_on_tiktok(alert_id: int, data: TikTokPostRequest,
                            background_tasks: BackgroundTasks,
                            user_id: int = Depends(current_user)):
    _owned_alert(alert_id, user_id)
    if not data.consent:
        raise HTTPException(status_code=422, detail="Confirm that you want to publish this recording")
    video = _video(alert_id)
    if not video or video["status"] != "ready":
        raise HTTPException(status_code=409, detail="Record a video first")
    _stored_path(video)
    if video["tiktok_publish_id"] and video["tiktok_status"] != "FAILED":
        raise HTTPException(status_code=409, detail="This recording was already sent to TikTok")
    if data.brand_content and data.privacy_level not in ("PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS"):
        raise HTTPException(status_code=422, detail="TikTok branded content requires public or friends visibility")
    try:
        options = await tiktok_creator_info(user_id)
        if data.privacy_level not in options["privacy_options"]:
            raise HTTPException(status_code=422, detail="Choose a privacy option offered for this account")
        if video["duration_seconds"] > options["max_duration_seconds"]:
            raise HTTPException(status_code=422, detail="This video exceeds this account's maximum post duration")
        if ((data.allow_comment and options["comment_disabled"]) or
            (data.allow_duet and options["duet_disabled"]) or
            (data.allow_stitch and options["stitch_disabled"])):
            raise HTTPException(status_code=422, detail="An interaction setting is disabled by this TikTok account")
        publish_id = await post_to_tiktok(
            user_id, video, data.privacy_level, data.title,
            data.allow_comment, data.allow_duet, data.allow_stitch,
            data.brand_organic, data.brand_content,
        )
    except VideoProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    cursor.execute(Queries.SET_ALERT_VIDEO_TIKTOK, (publish_id, "PROCESSING", alert_id))
    cursor.commit()
    # TikTok receives its verified pull URL first. Drive sharing follows only if
    # this user has connected Google; a later connection can upload manually.
    try:
        google_connected = bool(connection("google", user_id))
    except VideoProviderError:
        google_connected = False
    if video["drive_status"] in ("not_uploaded", "failed") and google_connected:
        cursor.execute(Queries.MARK_ALERT_VIDEO_DRIVE_UPLOADING, (alert_id,))
        cursor.commit()
        background_tasks.add_task(_send_to_drive, alert_id, user_id)
    return {"status": "PROCESSING", "publish_id": publish_id}


@router.get("/{alert_id}/video/tiktok")
async def posting_status(alert_id: int, user_id: int = Depends(current_user)):
    _owned_alert(alert_id, user_id)
    video = _video(alert_id)
    if not video or not video["tiktok_publish_id"]:
        return {"status": "not_posted"}
    try:
        result = await tiktok_post_status(user_id, video["tiktok_publish_id"])
    except VideoProviderError:
        result = {"status": video["tiktok_status"] or "PROCESSING",
                  "fail_reason": video["tiktok_fail_reason"]}
    cursor.execute(Queries.UPDATE_ALERT_VIDEO_TIKTOK_STATUS,
                   (result["status"], result["fail_reason"], alert_id))
    cursor.commit()
    return result


def _signed_file(credentials: tuple[int, int] | None) -> FileResponse:
    if not credentials:
        raise HTTPException(status_code=401, detail="Video link expired")
    alert_id, user_id = credentials
    _owned_alert(alert_id, user_id)
    video = _video(alert_id)
    if not video:
        raise HTTPException(status_code=404, detail="Recording not found")
    return FileResponse(_stored_path(video), media_type=video["mime_type"],
                        headers={"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex"})


@pull_router.get("/tiktok/{token}")
@pull_router.head("/tiktok/{token}")
def tiktok_video_pull(token: str):
    return _signed_file(Token.ValidateTikTokVideoPull(token))


@pull_router.get("/preview/{token}")
def recording_preview(token: str):
    return _signed_file(Token.ValidateVideoPreview(token))
