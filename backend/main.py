from contextlib import asynccontextmanager
from pathlib import Path

from modules.credentials import get_credentials
from modules.logs        import get_logger
from modules.pages       import Pages
from modules.routers     import auth, users, contacts, alerts, features, telegram as telegram_router, dashboard
from modules.telegram    import Telegram

from fastapi                  import FastAPI
from fastapi.middleware.cors  import CORSMiddleware
from fastapi.responses        import HTMLResponse
from fastapi.staticfiles      import StaticFiles


_docs_enabled: bool = get_credentials()['app_mode'] != "Deploy"
_credentials: dict = get_credentials()
_logger = get_logger(__name__)


@asynccontextmanager
async def _lifespan(app: FastAPI):
    _logger.info(f"Starting Panic Button API (app_mode={_credentials['app_mode']})")
    # Best-effort and non-blocking on failure: a backend with no Telegram bot
    # configured (local dev, or before the client sets one up) should still
    # boot normally, just without this feature wired up.
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

# The mobile app's WebView loads the UI from a local origin, not from this API's
# own origin, so the browser engine inside it enforces CORS on every request it
# makes here. These are Capacitor's own fixed WebView origins (iOS uses the
# capacitor:// scheme, Android's default androidScheme is https) — not a
# wildcard, since the app never changes what origin it runs from.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["capacitor://localhost", "http://localhost", "https://localhost"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# CSS/JS for the server-rendered web pages (landing, dashboard, confirmation
# result) — kept out of the Jinja templates themselves so they're plain,
# cacheable, browser-devtools-editable assets instead of strings baked into
# an HTML response every time. Not related to the app's own static assets
# (those ship inside the Capacitor build, see docs/app/architecture.md).
app.mount("/static", StaticFiles(directory=Path(__file__).resolve().parent / "static"), name="static")

@app.get("/", response_class=HTMLResponse)
def root():
    return Pages.Render("landing", {})


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(contacts.router)
app.include_router(alerts.router)
app.include_router(features.router)
app.include_router(telegram_router.router)
app.include_router(dashboard.router)
