import unittest
from unittest.mock import AsyncMock, patch

import httpx

from modules import google_drive
from modules.routers import videos


async def chunks():
    yield b"recorded-"
    yield b"video"


class DriveVideoFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_recording_is_streamed_to_drive_and_made_public(self):
        requests = []

        async def respond(request):
            body = await request.aread()
            requests.append((request, body))
            if request.method == "POST" and request.url.path == "/upload/drive/v3/files":
                return httpx.Response(200, headers={
                    "Location": "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test",
                })
            if request.method == "PUT":
                return httpx.Response(200, json={"id": "drive-file-1"})
            if request.method == "POST" and request.url.path.endswith("/permissions"):
                return httpx.Response(200, json={"id": "permission-1"})
            if request.method == "GET":
                return httpx.Response(200, json={
                    "webViewLink": "https://drive.google.com/file/d/drive-file-1/view",
                })
            return httpx.Response(500)

        transport = httpx.MockTransport(respond)
        real_client = httpx.AsyncClient
        with patch.object(google_drive, "access_token", new=AsyncMock(return_value="user-token")), \
             patch.object(google_drive.httpx, "AsyncClient",
                          side_effect=lambda **kwargs: real_client(transport=transport)):
            file_id, url = await google_drive.upload_stream(
                6, chunks(), "video/webm", len(b"recorded-video"), "alert-47.webm",
            )

        self.assertEqual(file_id, "drive-file-1")
        self.assertEqual(url, "https://drive.google.com/file/d/drive-file-1/view")
        upload = next(item for item in requests if item[0].method == "PUT")
        self.assertEqual(upload[1], b"recorded-video")
        self.assertEqual(upload[0].headers["content-length"], str(len(b"recorded-video")))
        permission = next(item for item in requests if item[0].url.path.endswith("/permissions"))
        self.assertIn(b'"type":"anyone"', permission[1])
        self.assertIn(b'"role":"reader"', permission[1])

    async def test_declared_size_mismatch_fails(self):
        async def respond(request):
            await request.aread()
            if request.method == "POST":
                return httpx.Response(200, headers={
                    "Location": "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test",
                })
            return httpx.Response(200, json={"id": "drive-file-1"})

        transport = httpx.MockTransport(respond)
        real_client = httpx.AsyncClient
        with patch.object(google_drive, "access_token", new=AsyncMock(return_value="user-token")), \
             patch.object(google_drive.httpx, "AsyncClient",
                          side_effect=lambda **kwargs: real_client(transport=transport)):
            with self.assertRaises(google_drive.DriveError):
                await google_drive.upload_stream(6, chunks(), "video/webm", 99, "alert-47.webm")

    def test_alert_view_only_receives_a_ready_drive_link(self):
        with patch.object(videos, "_video", return_value={
            "drive_status": "uploading", "drive_url": None,
        }):
            self.assertEqual(videos.video_public_status(47),
                             {"status": "uploading", "url": None})
        with patch.object(videos, "_video", return_value={
            "drive_status": "ready", "drive_url": "https://drive.google.com/file/d/example/view",
        }):
            self.assertEqual(videos.video_public_status(47),
                             {"status": "ready",
                              "url": "https://drive.google.com/file/d/example/view"})


if __name__ == "__main__":
    unittest.main()
