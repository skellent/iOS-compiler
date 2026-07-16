from fastapi import APIRouter, HTTPException

from modules.cursor  import Querys, RegistroDuplicadoError
from modules.db      import cursor
from modules.guard   import Guard
from modules.token   import Token
from modules.types   import Usuario, UsuarioLogin

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/registro", status_code=201)
def registrar(data: Usuario):
    hash_contraseña: str = Guard.Crear(data.contraseña)
    try:
        cursor.execute(Querys.INSERT_USUARIO, (
            data.nombre,
            data.telefono,
            data.correo,
            hash_contraseña)
        )
    except RegistroDuplicadoError:
        raise HTTPException(status_code=409, detail="El teléfono o correo ya está registrado")
    cursor.commit()

    return {"Skellent": "Success!"}


@router.post("/login")
def login(data: UsuarioLogin):
    filas: list[dict] = cursor.execute(Querys.SELECT_USUARIO_POR_CORREO, (data.correo,))
    if not filas or not Guard.Validar(data.contraseña, filas[0]["contraseña_hash"]):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

    token: str = Token.Crear(filas[0]["id"])
    return {"access_token": token, "token_type": "bearer"}
