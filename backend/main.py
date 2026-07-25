from modules.credentials import get_credentials
from modules.routers     import auth, users, contacts, alerts

from fastapi                  import FastAPI
from fastapi.middleware.cors  import CORSMiddleware


_docs_enabled: bool = get_credentials()['app_mode'] != "Deploy"

app = FastAPI(
    docs_url=("/docs" if _docs_enabled else None),
    redoc_url=("/redoc" if _docs_enabled else None),
    openapi_url=("/openapi.json" if _docs_enabled else None),
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
