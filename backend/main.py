from modules.routers import auth, usuarios, contactos

from fastapi          import FastAPI


app = FastAPI()

@app.get("/")
def root():
    return {"Skellent": "You shouldn't be here, boy!" }


app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(contactos.router)
