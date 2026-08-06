# `modules/logs.py`

## Purpose

```python
def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
```

Before this module existed, the only way anything in the backend reported what it was doing was scattered `print(...)` calls (a connection failure in `cursor.py`, a Telegram webhook error, a failed email) — visible only if whoever ran `uvicorn` happened to be watching that terminal at that exact moment, and gone the second the process's stdout scrolled past or the terminal closed. `logs.py` replaces every one of those with a real `logging.Logger`, configured once, that every other module asks for by calling `get_logger(__name__)`.

## Why configuration lives here instead of in `main.py`

```python
_level_name: str = get_credentials()['log_level']
_level: int = getattr(logging, _level_name.upper(), logging.INFO)

_formatter = logging.Formatter(
    fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

_console_handler = logging.StreamHandler(sys.stdout)
_console_handler.setFormatter(_formatter)

_file_handler = RotatingFileHandler(
    _LOG_DIR / "panicbutton.log", maxBytes=5_000_000, backupCount=3, encoding="utf-8",
)
_file_handler.setFormatter(_formatter)

logging.basicConfig(level=_level, handlers=[_console_handler, _file_handler])
```

`logging.basicConfig(...)` only has an effect the *first* time it's called — Python's own `logging` module treats the root logger's handler list as something to set up once, and silently no-ops on later calls if handlers are already attached. `modules/cursor.py`, `modules/mail.py` and every router log something during import or at module level, so whichever of them happened to import `logging` first, however indirectly, would win the race and decide the formatting/handlers for the whole process if this configuration lived somewhere less central. Putting it in its own module, imported before anything else that logs (`main.py`'s very first import, see `main.md`), makes `logs.py` the one place this race is settled deliberately instead of by import order.

## Two handlers, not one

- **`StreamHandler(sys.stdout)`**: what `print()` was already giving for free — output visible in whatever terminal (or, in production, `journalctl`, since `panicbutton.service` runs under systemd, see the root `NGINX.md`) is attached to the process.
- **`RotatingFileHandler`**: a copy of the same stream, on disk, at `backend/logs/panicbutton.log` (`backend/.gitignore` excludes the whole `logs/` directory — these are runtime artifacts, not something to commit). Systemd's own journal already has its own retention policy in production, but nothing plays that role in local development, where a crash investigated after the fact needs *something* to `cat`. `maxBytes=5_000_000, backupCount=3` caps the damage a runaway log (a bug that logs in a tight loop, for instance) can do to disk space: once the active file hits 5 MB it's rotated to `.1`, pushing older backups to `.2`/`.3`, and the oldest is deleted — at most ~20 MB across all four files, not an unbounded file that grows for the life of the deployment.

Both handlers share the same `_formatter`, so a line looks identical whether it's read from the terminal or from the file: `2026-07-30 09:43:58 [WARNING] modules.routers.alerts: Panic alert 5 triggered by user 10 at 10.5,-66.9`.

## Why `%(name)s` in the format, and why callers pass `__name__`

Every call site in the codebase follows the same one-line pattern:

```python
from modules.logs import get_logger

_logger = get_logger(__name__)
```

`__name__` is the calling module's own dotted path (`modules.routers.alerts`, `modules.cursor`, `main`), not a string made up per file. `logging.getLogger(name)` returns the *same* logger object for the same name across the whole process, and `%(name)s` in the formatter prints it on every line — so a log entry says exactly which module produced it (`modules.telegram: Telegram rejected 'panic_alert' message to chat 999999: ...`) without that module having to embed its own name inside every message by hand. This is the standard `logging` idiom (`getLogger(__name__)`), not a project-specific invention — `get_logger` exists mainly so every caller imports one project module (`modules.logs`) instead of reaching for the standard library's `logging.getLogger` directly, keeping the door open to change the underlying mechanism later without touching every call site.

## Why a plain level name in `.env`, not a number

```env
LOG_LEVEL='INFO'
```

`getattr(logging, _level_name.upper(), logging.INFO)` reads `LOG_LEVEL` as text (`DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` — the standard `logging` level names) and looks up the matching module-level constant on `logging` itself, rather than asking whoever configures `.env` to know that `INFO` is `20` and `WARNING` is `30`. An unrecognized value (a typo, or `LOG_LEVEL` left unset) falls back to `logging.INFO` instead of raising `AttributeError` at import time — the same "a bad or missing setting shouldn't crash startup" posture `app_mode` already takes (see `credentials.md`). `INFO` was picked as the default level, not `DEBUG`, because at `DEBUG` some third-party dependencies (`passlib`, in particular) log at a volume that's noise for anything short of actively debugging that specific library.

## What gets logged, and at what level

There's no fixed rulebook enforced by this module — each call site decides its own level — but a pattern emerged consistently across the codebase while wiring this in:

- **`INFO`**: routine, expected events worth having a record of — a user registering or logging in, a contact being added, an email or Telegram message sent successfully, an alert being created.
- **`WARNING`**: something a client did wrong, not the server — a failed login attempt, a confirmation link used with an invalid or expired token, a stale MariaDB connection needing a silent reconnect (see `cursor.md`).
- **`ERROR`**: an outgoing notification failed to send (`Mail.Send`/`SendBulk`, `Telegram.Send`/`SendBulk`/`SetWebhook`, see `mail.md`, `telegram.md`) — logged right before the corresponding `MailNotSentError`/`TelegramNotSentError` is raised, so the failure is on record even though, for a background task, nothing downstream ever inspects that exception (see `mail.md`'s note on that tradeoff).
- **`CRITICAL`**: reserved for the one fail-fast path in the backend — `Cursor.__init__` calling `sys.exit(1)` when the very first MariaDB connection attempt fails (see `cursor.md`).

The panic-alert path (`POST /alerts`, see `routers.md`) is the clearest example of why this exists at all: before this module, a contact silently not receiving an alert — because `Mail.SendBulk` or `Telegram.SendBulk` failed in the background, after the `201` had already gone out — left no trace anywhere. Now it's an `ERROR` line naming exactly which recipient failed and why.

## Relationship with the rest of the backend

`main.py` imports `modules.logs` before anything else that might log (see `main.md`), guaranteeing this module's `logging.basicConfig(...)` call wins the race described above. From there, every other module that logs anything — `modules/cursor.py`, `modules/mail.py`, `modules/telegram.py`, and every file in `modules/routers/` — calls `get_logger(__name__)` once, at module level, the same way they each already read their own slice of `modules/credentials.py`. `modules/logs.py` itself depends only on `modules/credentials.py` (for `log_level`) and the standard library — it doesn't know `mariadb`, `aiosmtplib` or `httpx` exist, the same "this module doesn't need to know what's calling it" posture `modules/pages.py` takes (see `pages.md`).
