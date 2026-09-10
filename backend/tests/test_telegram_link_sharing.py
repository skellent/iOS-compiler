import unittest
from unittest.mock import patch

from modules.cursor import Queries
from modules.routers import contacts


class _TelegramLinkCursor:
    def __init__(self) -> None:
        self.rowcount = 1
        self.calls: list[tuple[str, tuple]] = []
        self.commits = 0

    def execute(self, query: str, params: tuple = ()) -> list[dict]:
        self.calls.append((query, params))
        return []

    def commit(self) -> None:
        self.commits += 1


class TelegramLinkSharingTests(unittest.TestCase):
    def test_enable_always_returns_the_deep_link_without_loading_email_data(self) -> None:
        fake_cursor = _TelegramLinkCursor()
        token = "T" * 32

        with patch.object(contacts, "cursor", fake_cursor), patch.object(
            contacts, "_TELEGRAM_BOT_USERNAME", "PanicButtonBot"
        ), patch.object(contacts.secrets, "token_urlsafe", return_value=token):
            result = contacts.enable_contact_telegram(contact_id=12, user_id=7)

        self.assertEqual(
            result,
            {"telegram_link_url": f"https://t.me/PanicButtonBot?start={token}"},
        )
        self.assertEqual(fake_cursor.commits, 1)
        self.assertEqual(fake_cursor.calls, [(
            Queries.SET_CONTACT_TELEGRAM_LINK_TOKEN,
            (token, contacts._LINK_EXPIRATION_HOURS, 12, 7),
        )])


if __name__ == "__main__":
    unittest.main()
