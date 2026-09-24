import asyncio
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from modules.app_assets  import APP_WWW_DIR, get_manifest
from modules.credentials import get_credentials
from modules.db          import cursor
from modules.limiter     import limiter
from modules.logs        import get_logger, reset_request_id, set_request_id
from modules.pages       import Pages
from modules.routers     import auth, users, contacts, alerts, features, integrations, videos, telegram as telegram_router, whatsapp as whatsapp_router, dashboard
from modules.telegram    import Telegram

from fastapi                  import FastAPI, Request
from fastapi.middleware.cors  import CORSMiddleware
from fastapi.responses        import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles      import StaticFiles

from slowapi          import _rate_limit_exceeded_handler
from slowapi.errors   import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware


_credentials: dict = get_credentials()
_docs_enabled: bool = _credentials['app_mode'] != "Deploy"
_logger = get_logger(__name__)


_WEBHOOK_KEEPER_INTERVAL: float = 1800.0


async def _telegram_webhook_keeper(url: str) -> None:
    while True:
        try:
            await asyncio.sleep(_WEBHOOK_KEEPER_INTERVAL)
            info: dict = await Telegram.GetWebhookInfo()
            if info.get("url") != url:
                _logger.warning(
                    f"Telegram webhook drifted (found {info.get('url') or 'none'}, expected {url}); re-registering"
                )
                await Telegram.EnsureWebhook(url)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            _logger.warning(f"Telegram webhook keeper check failed: {e}")


@asynccontextmanager
async def _lifespan(app: FastAPI):
    _logger.info(f"Starting Panic Button API (app_mode={_credentials['app_mode']})")

    # Fail loudly at startup rather than on the first request that needs a row.
    try:
        cursor.verify()
        _logger.info("Database connection verified")
    except Exception as e:
        _logger.critical(f"Could not reach the database: {e}")
        raise

    keeper_task: asyncio.Task | None = None
    if _credentials['telegram']['bot_token']:
        webhook_url: str = f"{_credentials['api_base_url']}/telegram/webhook"
        try:
            info: dict = await Telegram.EnsureWebhook(webhook_url)
            _logger.info(
                "Telegram webhook status: "
                f"url={info.get('url') or '(none registered)'} "
                f"pending_updates={info.get('pending_update_count')} "
                f"last_error={info.get('last_error_message') or 'none'}"
            )
        except Exception as e:
            _logger.error(f"Could not register Telegram webhook at {webhook_url}: {e}")
        keeper_task = asyncio.create_task(_telegram_webhook_keeper(webhook_url))

    yield

    if keeper_task is not None:
        keeper_task.cancel()
        try:
            await keeper_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    docs_url=("/docs" if _docs_enabled else None),
    redoc_url=("/redoc" if _docs_enabled else None),
    openapi_url=("/openapi.json" if _docs_enabled else None),
    lifespan=_lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["capacitor://localhost", "http://localhost", "https://localhost"],
    allow_methods=["*"],
    allow_headers=["*"],
)


_SECURITY_HEADERS: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
}


@app.middleware("http")
async def _request_context(request: Request, call_next):
    """Tag every log line from one request with the same id, and set security headers."""
    request_id: str = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
    token = set_request_id(request_id)
    try:
        try:
            response: Response = await call_next(request)
        except Exception:
            _logger.exception(f"Unhandled error on {request.method} {request.url.path}")
            response = JSONResponse(status_code=500, content={"detail": "Internal server error"})
    finally:
        reset_request_id(token)

    for header, value in _SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)
    if request.url.path.startswith("/app"):
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(self), camera=(self)"
    response.headers["X-Request-ID"] = request_id
    return response


app.mount("/static", StaticFiles(directory=Path(__file__).resolve().parent / "static"), name="static")

_FAVICON_PATH = Path(__file__).resolve().parent / "static" / "img" / "favicon.ico"


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse(_FAVICON_PATH, media_type="image/x-icon")


@app.get("/", response_class=HTMLResponse)
def root():
    return Pages.Render("landing", {
        "contact_email": _credentials['email']['from'],
        "base_url": _credentials['api_base_url'],
    })


@app.get("/privacy", response_class=HTMLResponse)
def privacy():
    return Pages.Render("privacy", {
        "contact_email": _credentials['email']['from'],
        "base_url": _credentials['api_base_url'],
        "company_name": "Keycodelogics",
        "website": "https://keycodelogics.com/",
        "updated_en": "September 24, 2026",
        "updated_es": "24 de septiembre de 2026",
    })


@app.get("/terms", response_class=HTMLResponse)
def terms():
    return Pages.Render("terms", {
        "contact_email": _credentials['email']['from'],
        "base_url": _credentials['api_base_url'],
        "company_name": "Keycodelogics",
        "website": "https://keycodelogics.com/",
        "updated_en": "September 24, 2026",
        "updated_es": "24 de septiembre de 2026",
    })


@app.get("/delete-account", response_class=HTMLResponse)
def delete_account_page():
    return Pages.Render("delete_account", {
        "base_url": _credentials['api_base_url'],
    })


@app.get("/robots.txt", response_class=PlainTextResponse)
def robots():
    base_url: str = _credentials['api_base_url']
    return (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /app\n"
        "Disallow: /dashboard\n"
        "Disallow: /docs\n"
        "Disallow: /a/\n"
        "Disallow: /alerts/view/\n"
        "Disallow: /videos/\n"
        f"Sitemap: {base_url}/sitemap.xml\n"
    )


@app.get("/sitemap.xml")
def sitemap():
    base_url: str = _credentials['api_base_url']
    xml: str = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'  <url><loc>{base_url}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>\n'
        f'  <url><loc>{base_url}/privacy</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>\n'
        f'  <url><loc>{base_url}/terms</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>\n'
        f'  <url><loc>{base_url}/delete-account</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>\n'
        '</urlset>\n'
    )
    return Response(content=xml, media_type="application/xml")


@app.get("/health")
def health():
    """Liveness + database reachability, for a process supervisor or uptime check."""
    try:
        cursor.execute("SELECT 1 AS ok;")
    except Exception as e:
        _logger.error(f"Health check failed: {e}")
        return JSONResponse(status_code=503, content={"status": "unhealthy", "database": False})
    return {"status": "ok", "database": True}


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
app.include_router(alerts.short_router)
app.include_router(features.router)
app.include_router(integrations.router)
app.include_router(videos.router)
app.include_router(telegram_router.router)
app.include_router(whatsapp_router.router)
app.include_router(dashboard.router)
