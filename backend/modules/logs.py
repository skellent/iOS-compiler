import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from modules.credentials import get_credentials

_LOG_DIR: Path = Path(__file__).resolve().parent.parent / "logs"
_LOG_DIR.mkdir(exist_ok=True)

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


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
