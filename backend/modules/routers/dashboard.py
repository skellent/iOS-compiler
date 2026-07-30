from fastapi           import APIRouter
from fastapi.responses import HTMLResponse

from modules.pages import Pages

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_class=HTMLResponse)
def dashboard():
    return HTMLResponse(Pages.Render("dashboard", {}))
