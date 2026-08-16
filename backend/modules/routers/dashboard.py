from fastapi           import APIRouter
from fastapi.responses import HTMLResponse

from modules.credentials import get_credentials
from modules.pages       import Pages

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_credentials: dict = get_credentials()


@router.get("", response_class=HTMLResponse)
def dashboard():
    return HTMLResponse(Pages.Render("dashboard", {"contact_email": _credentials['email']['from']}))
