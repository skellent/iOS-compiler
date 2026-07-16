from fastapi import APIRouter, Depends, HTTPException

from modules.cursor       import Querys, RegistroDuplicadoError
from modules.db           import cursor
from modules.dependencies import usuario_actual
from modules.guard        import Guard
from modules.types        import UsuarioUpdate

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

_COLUMNA_POR_CAMPO: dict[str, str] = {
    "nombre":     "nombre",
    "telefono":   "telefono",
    "correo":     "correo",
    "contraseña": "contraseña_hash",
}


@router.get("/me")
def obtener_usuario_actual(id_usuario: int = Depends(usuario_actual)):
    filas: list[dict] = cursor.execute(Querys.SELECT_USUARIO_POR_ID, (id_usuario,))
    if not filas:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return filas[0]


@router.put("/me")
def editar_usuario_actual(data: UsuarioUpdate, id_usuario: int = Depends(usuario_actual)):
    campos: dict = data.model_dump(exclude_none=True)
    if not campos:
        raise HTTPException(status_code=400, detail="No se proporcionaron campos para actualizar")

    if "contraseña" in campos:
        campos["contraseña"] = Guard.Crear(campos["contraseña"])

    set_clause: str = ", ".join(f"{_COLUMNA_POR_CAMPO[campo]} = %s" for campo in campos)
    valores: tuple = tuple(campos.values()) + (id_usuario,)

    try:
        cursor.execute(f"UPDATE usuarios SET {set_clause} WHERE id = %s;", valores)
    except RegistroDuplicadoError:
        raise HTTPException(status_code=409, detail="El teléfono o correo ya está registrado")
    cursor.commit()

    filas: list[dict] = cursor.execute(Querys.SELECT_USUARIO_POR_ID, (id_usuario,))
    return filas[0]
