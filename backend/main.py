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
# an HTML response every time. Not related to the app's own static assets,
# served separately below under /app.
app.mount("/static", StaticFiles(directory=Path(__file__).resolve().parent / "static"), name="static")

@app.get("/", response_class=HTMLResponse)
def root():
    return Pages.Render("landing", {"contact_email": _credentials['email']['from']})


class _NoCacheStaticFiles(StaticFiles):
    def file_response(self, *args, **kwargs) -> Response:
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-cache"
        return response


# The Capacitor app's WebView (see docs/app/architecture.md) navigates
# straight to this URL instead of loading a bundle shipped inside the native
# binary — the mobile "app" is really this backend's own web page, the same
# way an Electron shell just points a window at a URL. /app/manifest has to
# be registered before the /app mount below: Starlette matches routes in
# registration order, so the exact-path route wins over the mount for that
# one path, and everything else under /app/* falls through to the static
# files. Cache-Control: no-cache on every file (index.html included) forces
# a conditional revalidation on every request instead of letting the WebView
# serve a stale copy straight from its disk cache — see modules/app_assets.py
# and app/src/lib/appUpdate.js for the other half of this (the app noticing
# a new version and forcing a reload after being resumed from background).
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
