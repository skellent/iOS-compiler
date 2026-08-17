from contextlib import asynccontextmanager
from pathlib import Path

from modules.app_assets  import APP_WWW_DIR, get_manifest
from modules.credentials import get_credentials
from modules.logs        import get_logger
from modules.pages       import Pages
from modules.routers     import auth, users, contacts, alerts, features, telegram as telegram_router, dashboard
from modules.telegram    import Telegram

from fastapi                  import FastAPI
from fastapi.middleware.cors  import CORSMiddleware
from fastapi.responses        import HTMLResponse, Response
from fastapi.staticfiles      import StaticFiles


_docs_enabled: bool = get_credentials()['app_mode'] != "Deploy"
_credentials: dict = get_credentials()
_logger = get_logger(__name__)


@asynccontextmanager
async def _lifespan(app: FastAPI):
    _logger.info(f"Starting Panic Button API (app_mode={_credentials['app_mode']})")
    if _credentials['telegram']['bot_token']:
        try:
            webhook_url: str = f"{_credentials['api_base_url']}/telegram/webhook"
            await Telegram.SetWebhook(webhook_url)
            _logger.info(f"Telegram webhook registered at {webhook_url}")
        except Exception as e:
            _logger.error(f"Could not register Telegram webhook: {e}")
    yield


app = FastAPI(
    docs_url=("/docs" if _docs_enabled else None),
    redoc_url=("/redoc" if _docs_enabled else None),
    openapi_url=("/openapi.json" if _docs_enabled else None),
    lifespan=_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["capacitor://localhost", "http://localhost", "https://localhost"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=Path(__file__).resolve().parent / "static"), name="static")

@app.get("/", response_class=HTMLResponse)
def root():
    return Pages.Render("landing", {"contact_email": _credentials['email']['from']})


_LONG_CACHE_SUFFIXES = {".png", ".jpg", ".jpeg", ".svg", ".ico", ".webp"}


class _NoCacheStaticFiles(StaticFiles):
    def file_response(self, full_path, stat_result, scope, status_code=200) -> Response:
        response = super().file_response(full_path, stat_result, scope, status_code)
        if Path(full_path).suffix in _LONG_CACHE_SUFFIXES:
            response.headers["Cache-Control"] = "public, max-age=604800"
        else:
            response.headers["Cache-Control"] = "no-cache"
        return response


@app.get("/app/manifest")
def app_manifest():
    return get_manifest()

app.mount("/app", _NoCacheStaticFiles(directory=APP_WWW_DIR, html=True), name="app")


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(contacts.router)
app.include_router(alerts.router)
app.include_router(features.router)
app.include_router(telegram_router.router)
app.include_router(dashboard.router)
