"""
Email deliverability check.

Pydantic's EmailStr only checks that an address is well-formed. This adds the next
step: confirm the domain can actually receive mail (it has an MX record, or an A
record to fall back to), so a typo like "gmial.com" or a made-up domain is rejected
at the API boundary instead of silently producing an account whose confirmation
email can never arrive.

What this does NOT do: prove the specific mailbox exists. That needs an SMTP RCPT
probe, which most providers refuse or answer misleadingly, so it is deliberately
left out — domain-level verification is the honest, reliable check.
"""
from email_validator import EmailNotValidError, validate_email

from modules.credentials import get_credentials
from modules.logs import get_logger

_logger = get_logger(__name__)
_verify: bool = get_credentials()['email']['verify_deliverability']


class UndeliverableEmailError(ValueError):
    pass


def assert_deliverable(email: str) -> str:
    """
    Return the normalized address if its domain can receive mail; raise
    UndeliverableEmailError otherwise. A no-op when verification is disabled.
    """
    if not _verify:
        return email
    try:
        result = validate_email(email, check_deliverability=True)
        return result.normalized
    except EmailNotValidError as e:
        _logger.info(f"Rejected undeliverable email {email!r}: {e}")
        raise UndeliverableEmailError(
            "That email address can't receive mail — check it for typos."
        ) from e
