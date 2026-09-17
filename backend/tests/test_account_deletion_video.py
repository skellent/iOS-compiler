import unittest
from contextlib import nullcontext
from unittest.mock import patch

from modules.cursor import Queries
from modules.routers import auth


class AccountDeletionVideoTests(unittest.TestCase):
    def test_account_deletion_removes_drive_metadata_and_connection(self):
        statements = []

        def execute(query, params=()):
            statements.append(query)
            if query == Queries.SELECT_USER_BY_ID:
                return [{"id": 7}]
            return []

        with patch.object(auth.Token, "ValidateAccountDeletion", return_value=7), \
             patch.object(auth.cursor, "execute", side_effect=execute), \
             patch.object(auth.cursor, "transaction", return_value=nullcontext()):
            result = auth.perform_account_deletion("valid-token")

        self.assertEqual(result, {"account_deleted": True})
        self.assertIn(Queries.DELETE_ALERT_VIDEOS_BY_USER, statements)
        self.assertIn(Queries.DELETE_SOCIAL_CONNECTIONS_BY_USER, statements)
        self.assertIn(Queries.DELETE_USER_BY_ID, statements)


if __name__ == "__main__":
    unittest.main()
