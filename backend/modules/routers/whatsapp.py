from urllib.parse import parse_qsl

from fastapi           import APIRouter, Header, Request
from fastapi.responses import Response

from modules.credentials import get_credentials
from modules.cursor       import Queries
from modules.db           import cursor
from modules.logs         import get_logger
from modules.whatsapp     import validate_signature

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])

_credentials: dict = get_credentials()['whatsapp']
_WEBHOOK_URL: str = f"{get_credentials()['api_base_url']}/whatsapp/webhook"
_logger = get_logger(__name__)

_EMPTY_TWIML: str = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'


def _twiml_reply(message: str) -> str:
    escaped: str = (
        message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    )
    return f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>{escaped}</Message></Response>'


def _digits(sender: str) -> str:
    return "".join(ch for ch in sender if ch.isdigit())


@router.post("/webhook")
async def whatsapp_webhook(request: Request, x_twilio_signature: str | None = Header(default=None)):
    body: bytes = await request.body()
    params: dict = dict(parse_qsl(body.decode("utf-8", "replace")))

    if _credentials['validate_signature'] and _credentials['auth_token']:
        if not validate_signature(x_twilio_signature, _WEBHOOK_URL, params):
            _logger.warning("WhatsApp webhook rejected: invalid Twilio signature")
            return Response(content=_EMPTY_TWIML, media_type="application/xml", status_code=403)

    sender: str = params.get("From", "")
    digits: str = _digits(sender)
    if not digits:
        return Response(content=_EMPTY_TWIML, media_type="application/xml")

    rows: list[dict] = cursor.execute(Queries.SELECT_WHATSAPP_ENABLED_CONTACTS_BY_PHONE, (digits,))
    if not rows:
        return Response(content=_EMPTY_TWIML, media_type="application/xml")

    cursor.execute(Queries.CONFIRM_CONTACTS_WHATSAPP_BY_PHONE, (digits,))
    cursor.commit()

    contact_ids: list[int] = [row["id"] for row in rows]
    user_names: list[str] = sorted({row["user_name"] for row in rows})
    _logger.info(f"WhatsApp opt-in confirmed for contacts {contact_ids} from {digits}")

    names: str = ", ".join(user_names)
    reply: str = (
        f"You're set up on Panic Button. You'll get a message here whenever "
        f"{names} triggers a panic alert."
    )
    return Response(content=_twiml_reply(reply), media_type="application/xml")
