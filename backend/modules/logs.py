import logging
import sys
from contextvars import ContextVar, Token
from logging.handlers import RotatingFileHandler
from pathlib import Path

from modules.credentials import get_credentials

_LOG_DIR: Path = Path(__file__).resolve().parent.parent / "logs"
_LOG_DIR.mkdir(exist_ok=True)

_level_name: str = get_credentials()['log_level']
_level: int = getattr(logging, _level_name.upper(), logging.INFO)

# Set once per request by main.py's middleware. Background tasks started by a
# request inherit the context, so their log lines carry the same id.
_request_id: ContextVar[str] = ContextVar("request_id", default="-")


def set_request_id(value: str) -> Token:
    return _request_id.set(value)


def reset_request_id(token: Token) -> None:
    _request_id.reset(token)


def get_request_id() -> str:
    return _request_id.get()


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id.get()
        return True


_formatter = logging.Formatter(
    fmt="%(asctime)s [%(levelname)s] [%(request_id)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

_filter = _RequestIdFilter()

_console_handler = logging.StreamHandler(sys.stdout)
_console_handler.setFormatter(_formatter)
_console_handler.addFilter(_filter)

_file_handler = RotatingFileHandler(
    _LOG_DIR / "panicbutton.log", maxBytes=5_000_000, backupCount=3, encoding="utf-8",
)
_file_handler.setFormatter(_formatter)
_file_handler.addFilter(_filter)

logging.basicConfig(level=_level, handlers=[_console_handler, _file_handler])

# httpx logs every request line at INFO, including the full URL. Telegram puts the
# bot token *in the path* (api.telegram.org/bot<TOKEN>/sendMessage), so leaving this
# at INFO wrote the token in cleartext into panicbutton.log on every call.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
