import os
from functools import lru_cache

from dotenv import load_dotenv


class MissingCredentialError(RuntimeError):
    pass


def _require(name: str) -> str:
    value: str | None = os.getenv(name)
    if value is None or not value.strip():
        raise MissingCredentialError(
            f"{name} is not set. Add it to backend/.env (see .envexample)."
        )
    return value


def _as_int(name: str, default: int | None = None) -> int:
    raw: str | None = os.getenv(name)
    if raw is None or not raw.strip():
        if default is None:
            raise MissingCredentialError(
                f"{name} is not set. Add it to backend/.env (see .envexample)."
            )
        return default
    try:
        return int(raw)
    except ValueError:
        raise MissingCredentialError(f"{name} must be a whole number, got {raw!r}.") from None


@lru_cache(maxsize=1)
def get_credentials() -> dict:
    load_dotenv(override=True)

    return {
        "database": {
            'user':     _require("USERNAME"),
            'password': os.getenv("PASSWORD", ""),
            'host':     _require("HOST"),
            'port':     _as_int("PORT"),
            'database': _require("DATABASE"),
        },
        "api": {
            'Auth': None,
            'Key':  None,
        },
        "jwt": {
            'secret_key': _require("JWT_SECRET_KEY"),
        },
        "email": {
            'user':     os.getenv("SMTP_USER"),
            'password': os.getenv("SMTP_PASSWORD"),
            'host':     os.getenv("SMTP_HOST", "smtp.gmail.com"),
            'port':     _as_int("SMTP_PORT", 587),
            'from':     os.getenv("SMTP_FROM", os.getenv("SMTP_USER")),
            # Set SMTP_ENABLED=false to log outgoing mail instead of sending it —
            # for local development against a live SMTP account without spamming.
            'enabled':  os.getenv("SMTP_ENABLED", "true").strip().lower() not in ("false", "0", "no"),
            # Verify the recipient's domain can actually receive mail (MX/A lookup)
            # before accepting an address. Off for offline dev where DNS may fail.
            'verify_deliverability': os.getenv("SMTP_VERIFY_DELIVERABILITY", "true").strip().lower() not in ("false", "0", "no"),
        },
        "telegram": {
            'bot_token':      os.getenv("TELEGRAM_BOT_TOKEN"),
            'bot_username':   os.getenv("TELEGRAM_BOT_USERNAME"),
            'webhook_secret': os.getenv("TELEGRAM_WEBHOOK_SECRET"),
        },
        "api_base_url": os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/"),
        "app_mode": os.getenv("APP_MODE", "Debug"),
        "log_level": os.getenv("LOG_LEVEL", "INFO"),
    }
