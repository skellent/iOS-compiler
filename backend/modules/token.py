from datetime import datetime, timedelta, timezone

import jwt

from modules.credentials import get_credentials

ALGORITHM: str = "HS256"
EXPIRATION: timedelta = timedelta(days=30)
CONTACT_CONFIRMATION_EXPIRATION: timedelta = timedelta(days=7)
USER_CONFIRMATION_EXPIRATION: timedelta = timedelta(hours=24)

_secret: str = get_credentials()['jwt']['secret_key']

class Token:
    @staticmethod
    def Create(user_id: int) -> str:
        payload: dict = {
            "sub": str(user_id),
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
        return int(payload["contact_id"])

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
        return int(payload["user_id"])

    @staticmethod
    def CreateAlertNotificationView(notification_id: int) -> str:
        payload: dict = {
            "notification_id": notification_id,
            "type": "alert_notification_view",
        }
        return jwt.encode(payload, _secret, algorithm=ALGORITHM)

    @staticmethod
    def ValidateAlertNotificationView(token: str) -> int | None:
        payload: dict | None = Token.Validate(token)
        if payload is None or payload.get("type") != "alert_notification_view":
            return None
        return int(payload["notification_id"])
