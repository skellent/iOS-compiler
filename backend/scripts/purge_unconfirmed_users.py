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
