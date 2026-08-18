from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

MIN_PASSWORD_LENGTH: int = 8
MAX_PASSWORD_LENGTH: int = 128

# The app sends E.164-ish strings built by combinePhone(): a leading "+", then
# 6-15 digits. Kept deliberately loose — this rejects junk, it isn't a carrier check.
PHONE_PATTERN: str = r"^\+?[1-9]\d{5,14}$"

Name = Field(min_length=1, max_length=120)
Password = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)
Phone = Field(pattern=PHONE_PATTERN)


def _strip(value: str | None) -> str | None:
    return value.strip() if isinstance(value, str) else value


class User(BaseModel):
    name:     str = Name
    phone:    str = Phone
    email:    EmailStr
    password: str = Password

    _clean_name = field_validator("name", mode="before")(_strip)
    _clean_phone = field_validator("phone", mode="before")(_strip)


class UserLogin(BaseModel):
    # Deliberately a plain str, not EmailStr: login checks credentials, not format.
    # Any account created before validation existed must still be able to log in —
    # a stricter rule here would lock those users out with a 422 they can't fix.
    email:    str
    password: str


class UserUpdate(BaseModel):
    name:     str | None = Field(default=None, min_length=1, max_length=120)
    phone:    str | None = Field(default=None, pattern=PHONE_PATTERN)
    email:    EmailStr | None = None
    password: str | None = Field(default=None, min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)
    # Required by the API only when changing email or password (re-authentication);
    # ignored for name/phone edits.
    current_password: str | None = None

    _clean_name = field_validator("name", mode="before")(_strip)
    _clean_phone = field_validator("phone", mode="before")(_strip)


class UserPublic(BaseModel):
    """Response shape for /users/me — never carries password_hash, structurally."""
    id:        int
    name:      str
    phone:     str
    email:     str
    confirmed: bool = False


class Contact(BaseModel):
    name:  str = Name
    phone: str = Phone
    email: EmailStr | None = None

    _clean_name = field_validator("name", mode="before")(_strip)
    _clean_phone = field_validator("phone", mode="before")(_strip)


class ContactUpdate(BaseModel):
    name:  str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, pattern=PHONE_PATTERN)
    email: EmailStr | None = None

    _clean_name = field_validator("name", mode="before")(_strip)
    _clean_phone = field_validator("phone", mode="before")(_strip)


class ContactPublic(BaseModel):
    id:               int
    name:             str
    phone:            str
    email:            str | None = None
    confirmed:        bool = False
    telegram_linked:  bool = False


class Alert(BaseModel):
    latitude:  float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class AlertCreated(BaseModel):
    id:                 int
    created_at:         datetime | None = None
    notified_contacts:  int
    channels:           dict[str, int]


class TelegramLink(BaseModel):
    telegram_link_url: str | None = None
