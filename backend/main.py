from modules.cursor       import Cursor, Querys
from modules.credenciales import obtener_credenciales
from fastapi              import FastAPI

credenciales: dict = obtener_credenciales()

cursor: Cursor = Cursor(
    credenciales['database']['user'],
    credenciales['database']['password'],
    credenciales['database']['host'],
    credenciales['database']['port'],
    credenciales['database']['database'],
)

app = FastAPI()

@app.get("/")
def root():
    return {"mensaje": cursor.execute(Querys.SHOW_TABLES) }
