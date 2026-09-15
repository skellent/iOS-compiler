import tempfile
import unittest
from contextlib import nullcontext
from pathlib import Path
from unittest.mock import patch

from modules.cursor import Queries
from modules.routers import auth


class AccountDeletionVideoTests(unittest.TestCase):
    def test_account_deletion_removes_server_recording_after_database_cleanup(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            video_dir = root / "data" / "videos"
            video_dir.mkdir(parents=True)
            recording = video_dir / "alert.webm"
            recording.write_bytes(b"sample")
            statements = []

            def execute(query, params=()):
                statements.append(query)
                if query == Queries.SELECT_USER_BY_ID:
                    return [{"id": 7}]
                if query == Queries.SELECT_ALERT_VIDEO_PATHS_BY_USER:
                    return [{"local_path": str(recording)}]
                return []

            with patch.object(auth.Token, "ValidateAccountDeletion", return_value=7), \
                 patch.object(auth, "__file__", str(root / "modules" / "routers" / "auth.py")), \
                 patch.object(auth.cursor, "execute", side_effect=execute), \
                 patch.object(auth.cursor, "transaction", return_value=nullcontext()):
                result = auth.perform_account_deletion("valid-token")

            self.assertEqual(result, {"account_deleted": True})
            self.assertFalse(recording.exists())
            self.assertIn(Queries.DELETE_USER_BY_ID, statements)


if __name__ == "__main__":
    unittest.main()
