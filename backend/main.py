from modules.cursor       import Cursor, Querys
from modules.credenciales import obtener_credenciales
from modules.types        import Usuario
from modules.guard        import Guard

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
    return {"Skellent": "You shouldn't be here, boy!" }


@app.post("/registrar/usuario", status_code=201)
def registrar_usuario(data: Usuario):

    hash_contraseña: str = Guard.Crear(data.contraseña)
    cursor.execute(Querys.INSERT_USUARIO, (
        data.nombre,
        data.telefono,
        data.correo,
        hash_contraseña)
    )
    cursor.commit()

    return {"Skellent": "Success!"}
