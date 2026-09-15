import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx

from modules.routers import videos
from modules import social_video
from modules.token import Token


class TikTokVideoFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_tiktok_posts_the_server_recording_by_verified_pull_url_without_drive(self):
        requests = []

        def respond(request):
            requests.append(request)
            return httpx.Response(200, json={
                "data": {"publish_id": "post-123"},
                "error": {"code": "ok", "message": ""},
            })

        transport = httpx.MockTransport(respond)
        real_client = httpx.AsyncClient
        video = {"alert_id": 47}
        with patch.object(social_video, "access_token", new=AsyncMock(return_value="user-token")), \
             patch.object(social_video, "_BASE", "https://api.example.com"), \
             patch.object(social_video.httpx, "AsyncClient",
                          side_effect=lambda **kwargs: real_client(transport=transport)):
            publish_id = await social_video.post_to_tiktok(
                6, video, "SELF_ONLY", "My SOS video",
                False, False, False, False, False,
            )

        self.assertEqual(publish_id, "post-123")
        self.assertEqual(len(requests), 1)
        payload = json.loads(requests[0].content)
        self.assertEqual(payload["source_info"]["source"], "PULL_FROM_URL")
        self.assertNotIn("drive_file_id", video)
        self.assertEqual(payload["post_info"]["privacy_level"], "SELF_ONLY")
        url = payload["source_info"]["video_url"]
        self.assertTrue(url.startswith("https://api.example.com/videos/tiktok/"))
        self.assertEqual(Token.ValidateTikTokVideoPull(url.rsplit("/", 1)[1]), (47, 6))

    def test_alert_view_only_receives_a_link_after_drive_sharing_finishes(self):
        with patch.object(videos, "_video", return_value={
            "drive_status": "not_uploaded", "drive_url": None,
        }):
            self.assertEqual(videos.video_public_status(47),
                             {"status": "not_uploaded", "url": None})
        with patch.object(videos, "_video", return_value={
            "drive_status": "ready", "drive_url": "https://drive.google.com/file/d/example/view",
        }):
            self.assertEqual(videos.video_public_status(47),
                             {"status": "ready",
                              "url": "https://drive.google.com/file/d/example/view"})


if __name__ == "__main__":
    unittest.main()
