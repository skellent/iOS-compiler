# `scripts/`

## Purpose

Standalone, one-off maintenance scripts that touch the database directly but aren't part of the HTTP API — nothing here is imported by `main.py` or any router (see `main.md`, `routers.md`). Each file is meant to be run manually or by an external scheduler (cron), not called from inside the FastAPI process.

Right now there's a single script:

- **`purge_unconfirmed_users.py`**: deletes accounts that registered but never confirmed their email within 24 hours.

## Why maintenance jobs live outside the API process

An alternative would have been an in-process scheduler (e.g. APScheduler) started alongside uvicorn, or a `DELETE ... /admin/purge` endpoint triggered by an external cron job with `curl`. Both were rejected:

- An in-process scheduler ties the job's lifetime to the API server's. If the process is restarted, redeployed, or ever scaled to more than one worker, the job either stops running or runs multiple times concurrently on the same rows — a problem this project has no infrastructure to coordinate around yet (see `db.md` on why there's a single shared connection in the first place).
- An HTTP endpoint means authenticating a cron job against the API (a new credential to manage) just to run a query that has nothing to do with serving a request.

A plain script invoked by the system's own cron is the standard, low-ceremony way to run periodic maintenance against a project this size: it reuses the exact same `Cursor` connection setup as the API (`modules/db.py`, see `db.md`), and its failure mode is a non-zero exit code in a cron log, not a wedged web server.

## `purge_unconfirmed_users.py`

```python
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
```

### Why it's safe to delete unconditionally

`Queries.PURGE_UNCONFIRMED_USERS` (see `cursor.md`) is:

```sql
DELETE FROM users WHERE confirmed = FALSE AND created_at < (NOW() - INTERVAL 24 HOUR);
```

No `NOT EXISTS` guard against `contacts` or `alerts` is needed, even though both have a `FOREIGN KEY (user_id) REFERENCES users(id)` (see `sql.md`), because `POST /auth/login` refuses to issue a token to an unconfirmed account (see `routers.md`). Without a token, `Depends(current_user)` (see `dependencies.md`) rejects every write, so an unconfirmed user is, by construction, incapable of ever owning a contact or an alert. This is also why the user-confirmation token's expiration (`USER_CONFIRMATION_EXPIRATION`, see `token.md`) is set to 24 hours, matching this window exactly: a link that's still technically "valid" past the point where the account was already deleted would be a confusing dead end.

There's a companion index on `users(confirmed, created_at)` (see `sql.md`) so this `WHERE` clause stays a lookup instead of a full table scan as the table grows — a query that's cheap today would otherwise quietly become an hourly full scan once there are enough rows to notice.

### The `sys.path` line

```python
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
```

Every other file in the backend (`main.py`, `modules/routers/*.py`) is only ever run with the `backend/` directory as the working directory (`uv run uvicorn main:app`), which is what makes `from modules.cursor import Queries` resolve. A script in `scripts/` has no such guarantee — cron runs commands with whatever working directory is configured (or none at all), so without this line, `import modules...` would fail unless the caller happened to `cd` into `backend/` first. Inserting the parent of `scripts/` (i.e. `backend/`) at the front of `sys.path` makes the script importable from anywhere, the same way `main.py` already is when uvicorn runs it.

### Running it manually

```bash
cd backend
uv run python scripts/purge_unconfirmed_users.py
```

Prints how many rows it removed and exits. Safe to run as often as you like — a run with nothing to purge just prints `Purged 0 unconfirmed user(s) older than 24 hours.`

### Wiring it to cron

This isn't done automatically by anything in the repo — whoever deploys the project has to add it to the crontab of the account that owns `backend/`:

```cron
0 * * * * cd /path/to/PanicSwitch/backend && /path/to/uv run python scripts/purge_unconfirmed_users.py >> /var/log/panicswitch/purge.log 2>&1
```

Hourly is arbitrary but reasonable: the deletion window is 24 hours, so running more often than that just makes the moment of deletion more precise, not more correct.

## Relationship with the rest of the backend

Scripts here import `cursor` from `modules/db.py` (see `db.md`) exactly like a router would — from the database's point of view, a script run is indistinguishable from any other write. Nothing under `modules/routers/` imports anything from `scripts/`; the dependency only ever goes one way.
