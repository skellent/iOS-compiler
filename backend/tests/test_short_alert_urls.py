import hashlib
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from jinja2 import Environment, FileSystemLoader

from modules.cursor import Queries
from modules.pages import Pages
from modules.routers import alerts


class _InsertCursor:
    def __init__(self) -> None:
        self.lastrowid = 73
        self.calls: list[tuple[str, tuple]] = []
        self.commits = 0

    def execute(self, query: str, params: tuple = ()) -> list[dict]:
        self.calls.append((query, params))
        return []

    def commit(self) -> None:
        self.commits += 1


class _LookupCursor:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows
        self.calls: list[tuple[str, tuple]] = []

    def execute(self, query: str, params: tuple = ()) -> list[dict]:
        self.calls.append((query, params))
        return self.rows


class ShortAlertUrlTests(unittest.TestCase):
    def test_notification_gets_a_22_character_token_but_database_only_gets_its_hash(self) -> None:
        fake_cursor = _InsertCursor()
        token = "A" * 22

        with patch.object(alerts, "cursor", fake_cursor), patch.object(
            alerts.secrets, "token_urlsafe", return_value=token
        ):
            notification_id, generated_token = alerts._create_notification(8, 13, "Contact", "sms")

        self.assertEqual(notification_id, 73)
        self.assertEqual(generated_token, token)
        self.assertEqual(fake_cursor.commits, 1)
        query, params = fake_cursor.calls[0]
        self.assertEqual(query, Queries.INSERT_ALERT_NOTIFICATION)
        self.assertEqual(params[:4], (8, 13, "Contact", "sms"))
        self.assertEqual(params[4], hashlib.sha256(token.encode()).digest())
        self.assertNotIn(token, params)
        self.assertGreater(params[5], datetime.now(timezone.utc).replace(tzinfo=None))

    def test_valid_short_token_is_looked_up_by_hash(self) -> None:
        fake_cursor = _LookupCursor([{"id": 91}])
        token = "AbCdEf0123456789_-ABCD"

        with patch.object(alerts, "cursor", fake_cursor):
            notification_id = alerts._notification_id_from_short_token(token)

        self.assertEqual(notification_id, 91)
        self.assertEqual(fake_cursor.calls, [(
            Queries.SELECT_ALERT_NOTIFICATION_ID_BY_SHORT_TOKEN_HASH,
            (hashlib.sha256(token.encode()).digest(),),
        )])

    def test_malformed_short_token_is_rejected_without_database_query(self) -> None:
        fake_cursor = _LookupCursor([{"id": 91}])

        with patch.object(alerts, "cursor", fake_cursor):
            self.assertIsNone(alerts._notification_id_from_short_token("too-short"))
            self.assertIsNone(alerts._notification_id_from_short_token("!" * 22))

        self.assertEqual(fake_cursor.calls, [])

    def test_short_url_uses_the_compact_route(self) -> None:
        token = "A" * 22
        url = alerts._short_view_url(token)

        self.assertEqual(url, f"{alerts._URL_BASE}/a/{token}")
        self.assertNotIn("/alerts/view/", url)

    def test_live_page_receives_the_short_websocket_path(self) -> None:
        token = "A" * 22
        html = Pages.Render("live_alert", {
            "live_path": f"/a/{token}/live",
            "video_path": f"/a/{token}/video",
            "user_name": "Test User",
            "user_phone": "+15551234567",
            "tile_url": "https://tiles.example/{z}/{x}/{y}.png",
            "tile_attribution": "Map",
        })

        self.assertIn(f'"livePath": "/a/{token}/live"', html)
        self.assertIn(f'"videoPath": "/a/{token}/video"', html)

    def test_sms_template_is_ascii_and_compact_for_a_typical_alert(self) -> None:
        template_dir = Path(__file__).resolve().parents[1] / "templates" / "sms"
        environment = Environment(loader=FileSystemLoader(template_dir))
        message = environment.get_template("panic_alert.txt.j2").render(
            user_name="Example User",
            timestamp="09/09/2026 12:34:56",
            map_url="https://panicbutton.me/a/" + "A" * 22,
            user_phone="+584121234567",
        )

        message.encode("ascii")
        self.assertLessEqual(len(message), 160)


if __name__ == "__main__":
    unittest.main()
