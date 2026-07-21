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
