"""Delete unconfirmed user accounts older than 24 hours.

Meant to be run periodically (e.g. via cron), not imported. Since login is
blocked for unconfirmed accounts (see routers/auth.py), an unconfirmed user
can never have contacts or alerts, so deleting them here is always safe.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from modules.cursor import Queries
from modules.db      import cursor


def main() -> None:
    cursor.execute(Queries.PURGE_UNCONFIRMED_USERS)
    removed: int = cursor.rowcount
    cursor.commit()
    print(f"Purged {removed} unconfirmed user(s) older than 24 hours.")


if __name__ == "__main__":
    main()
