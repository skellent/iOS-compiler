from contextlib import asynccontextmanager

from modules.credentials import get_credentials
from modules.routers     import auth, users, contacts, alerts, telegram as telegram_router
from modules.telegram    import Telegram

from fastapi                  import FastAPI
from fastapi.middleware.cors  import CORSMiddleware


_docs_enabled: bool = get_credentials()['app_mode'] != "Deploy"
_credentials: dict = get_credentials()


@asynccontextmanager
async def _lifespan(app: FastAPI):
    # Best-effort and non-blocking on failure: a backend with no Telegram bot
    # configured (local dev, or before the client sets one up) should still
    # boot normally, just without this feature wired up.
    if _credentials['telegram']['bot_token']:
        try:
            webhook_url: str = f"{_credentials['api_base_url']}/telegram/webhook"
            await Telegram.SetWebhook(webhook_url)
        except Exception as e:
            print(f"Could not register Telegram webhook: {e}")
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

@app.get("/")
def root():
    return {"Skellent": "You shouldn't be here, boy!" }


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(contacts.router)
app.include_router(alerts.router)
app.include_router(telegram_router.router)
