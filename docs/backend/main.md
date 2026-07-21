# `main.py`

## Purpose

It's the API's entry point: this is where the FastAPI application is instantiated and the rest of the functionality gets mounted. It's the module `uvicorn` loads when running `uvicorn main:app` (see README, "Prepare the Environment" section).

```python
from modules.routers import auth, users, contacts, alerts

from fastapi          import FastAPI


app = FastAPI()

@app.get("/")
def root():
    return {"Skellent": "You shouldn't be here, boy!" }


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(contacts.router)
app.include_router(alerts.router)
```

There used to be a single business endpoint (`registrar_usuario`) written directly here, and `main.py` also used to be responsible for reading credentials and opening the MariaDB connection. With login, editing users, and the contacts CRUD arriving, that file would have grown without limit and mixed together things that have nothing to do with each other (registration, authentication, contacts) in one place. That's why this file was deliberately emptied out: now `main.py` only does two things — create the app and tell it which routers exist — and all the business logic lives in `modules/routers/` (see `routers.md`).

## Module diagram

```mermaid
flowchart TD
    subgraph main["main.py"]
        APP["FastAPI app"]
    end

    subgraph routers["modules/routers/ (routers.md)"]
        AUTH["auth.py<br/>/auth/register<br/>/auth/login"]
        USR["users.py<br/>/users/me"]
        CON["contacts.py<br/>/contacts<br/>/contacts/confirm/{token}"]
        ALT["alerts.py<br/>/alerts"]
    end

    DEPS["modules/dependencies.py<br/>current_user"]
    TOKEN["modules/token.py<br/>Token"]
    GUARD["modules/guard.py<br/>Guard"]
    MAIL["modules/mail.py<br/>Mail (mail.md)"]
    DB["modules/db.py<br/>cursor"]
    CURSOR["modules/cursor.py<br/>Cursor / Queries"]
    CRED["modules/credentials.py"]
    MARIADB[(MariaDB)]
    SMTP[(smtp.gmail.com)]

    APP --> AUTH
    APP --> USR
    APP --> CON
    APP --> ALT

    AUTH --> GUARD
    AUTH --> TOKEN
    AUTH --> DB

    USR --> DEPS
    USR --> DB
    USR --> GUARD

    CON --> DEPS
    CON --> DB
    CON --> TOKEN
    CON --> MAIL

    ALT --> DEPS
    ALT --> DB
    ALT --> MAIL

    DEPS --> TOKEN

    DB --> CURSOR
    DB --> CRED
    CURSOR --> MARIADB
    MAIL --> SMTP
```

This diagram is, at bottom, the module dependency map the backend currently has. It's useful to keep in mind because it shows at a glance why `main.py` imports what it imports and nothing more: it doesn't need to know anything about `mariadb`, JWT, bcrypt, or SMTP — it only needs to know about the four routers and mount them.

## Module-level initialization

```python
app = FastAPI()
```

This is all `main.py` initializes on its own. The MariaDB connection (previously created here, see this document's git history if you need to compare) now opens in `modules/db.py` (see `db.md`) the first time some router imports it. The underlying behavior is identical to before — it's still **a single connection**, shared, opened when the process starts, not one per request — only the file it lives in changed, so routers can import it without depending on `main.py` (which would have created a circular import: `main` imports the routers, and the routers would need to import back from `main` to get the cursor).

## `GET /`

```python
@app.get("/")
def root():
    return {"Skellent": "You shouldn't be here, boy!" }
```

It's the API's root route. It serves no business purpose: it acts as a quick check that the server is up and responding (an informal health-check endpoint), and incidentally makes casual exploration of the API a bit harder for someone who lands on the root without knowing what they're looking at. It's the only route that stays living directly in `main.py`: it doesn't belong to any business resource (it's not "users," it's not "contacts"), so there's no reason to move it into a router.

## `app.include_router(...)`

```python
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(contacts.router)
app.include_router(alerts.router)
```

Each module inside `modules/routers/` defines its own `APIRouter` with a prefix (`/auth`, `/users`, `/contacts`, `/alerts`) and its own endpoints (see `routers.md` for the detail of each one). `include_router` is the mechanism FastAPI offers to "attach" those routes, already defined in another file, to the main application, as if they had been declared directly on `app`. `routers/alerts.py` is the most recent example of why this matters: an entire new resource was added (triggering the panic button) by adding a file and a single line here, without touching anything that already existed.

## What's still missing (for now)

Logging alerts (`POST /alerts`, see `routers.md`) already exists and already notifies a user's **confirmed** emergency contacts by email (see `mail.md`, `sql.md`). What's still pending is notifying by SMS or another channel in addition to email — the integration with Twilio's API (or an equivalent) hasn't started yet, and it particularly matters for contacts who don't have an `email` on file (see `types.md`) and today have no way to confirm or be notified.
