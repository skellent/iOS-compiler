from datetime import datetime, timedelta, timezone

import jwt

from modules.credentials import get_credentials

ALGORITHM: str = "HS256"
EXPIRATION: timedelta = timedelta(days=30)
CONTACT_CONFIRMATION_EXPIRATION: timedelta = timedelta(days=7)
USER_CONFIRMATION_EXPIRATION: timedelta = timedelta(hours=24)
ALERT_VIEW_EXPIRATION: timedelta = timedelta(days=30)
PASSWORD_RESET_EXPIRATION: timedelta = timedelta(hours=1)
ACCOUNT_DELETION_EXPIRATION: timedelta = timedelta(hours=1)

SESSION_TYPE: str = "session"
PASSWORD_RESET_TYPE: str = "password_reset"
ACCOUNT_DELETION_TYPE: str = "account_deletion"

_secret: str = get_credentials()['jwt']['secret_key']

class Token:
    @staticmethod
    def Create(user_id: int) -> str:
        payload: dict = {
            "sub": str(user_id),
            "type": SESSION_TYPE,
            "exp": datetime.now(timezone.utc) + EXPIRATION,
        }
        return jwt.encode(payload, _secret, algorithm=ALGORITHM)

    @staticmethod
    def Validate(token: str) -> dict | None:
        try:
            return jwt.decode(token, _secret, algorithms=[ALGORITHM])
        except jwt.InvalidTokenError:
            return None

    @staticmethod
    def ValidateSession(token: str) -> int | None:
        payload: dict | None = Token.Validate(token)
        if payload is None or payload.get("type") != SESSION_TYPE:
            return None
        subject = payload.get("sub")
        if subject is None:
            return None
        try:
            return int(subject)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def CreateContactConfirmation(contact_id: int) -> str:
        payload: dict = {
            "contact_id": contact_id,
            "type": "contact_confirmation",
            "exp": datetime.now(timezone.utc) + CONTACT_CONFIRMATION_EXPIRATION,
        }
        return jwt.encode(payload, _secret, algorithm=ALGORITHM)

    @staticmethod
    def ValidateContactConfirmation(token: str) -> int | None:
        payload: dict | None = Token.Validate(token)
        if payload is None or payload.get("type") != "contact_confirmation":
            return None
        return _as_id(payload.get("contact_id"))

    @staticmethod
    def CreateUserConfirmation(user_id: int) -> str:
        payload: dict = {
            "user_id": user_id,
            "type": "user_confirmation",
            "exp": datetime.now(timezone.utc) + USER_CONFIRMATION_EXPIRATION,
        }
        return jwt.encode(payload, _secret, algorithm=ALGORITHM)

    @staticmethod
    def ValidateUserConfirmation(token: str) -> int | None:
        payload: dict | None = Token.Validate(token)
        if payload is None or payload.get("type") != "user_confirmation":
            return None
        return _as_id(payload.get("user_id"))

    @staticmethod
    def CreatePasswordReset(user_id: int) -> str:
        payload: dict = {
            "user_id": user_id,
            "type": PASSWORD_RESET_TYPE,
            "exp": datetime.now(timezone.utc) + PASSWORD_RESET_EXPIRATION,
        }
        return jwt.encode(payload, _secret, algorithm=ALGORITHM)

    @staticmethod
    def ValidatePasswordReset(token: str) -> int | None:
        payload: dict | None = Token.Validate(token)
        if payload is None or payload.get("type") != PASSWORD_RESET_TYPE:
            return None
        return _as_id(payload.get("user_id"))

    @staticmethod
    def CreateAccountDeletion(user_id: int) -> str:
        payload: dict = {
            "user_id": user_id,
            "type": ACCOUNT_DELETION_TYPE,
            "exp": datetime.now(timezone.utc) + ACCOUNT_DELETION_EXPIRATION,
        }
        return jwt.encode(payload, _secret, algorithm=ALGORITHM)

    @staticmethod
    def ValidateAccountDeletion(token: str) -> int | None:
        payload: dict | None = Token.Validate(token)
        if payload is None or payload.get("type") != ACCOUNT_DELETION_TYPE:
            return None
        return _as_id(payload.get("user_id"))

    @staticmethod
    def CreateAlertNotificationView(notification_id: int) -> str:
        payload: dict = {
            "notification_id": notification_id,
            "type": "alert_notification_view",
            "exp": datetime.now(timezone.utc) + ALERT_VIEW_EXPIRATION,
        }
        return jwt.encode(payload, _secret, algorithm=ALGORITHM)

    @staticmethod
    def ValidateAlertNotificationView(token: str) -> int | None:
        payload: dict | None = Token.Validate(token)
        if payload is None or payload.get("type") != "alert_notification_view":
            return None
        return _as_id(payload.get("notification_id"))


def _as_id(value) -> int | None:
    """A well-formed token with a junk id must fail validation, not raise."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
