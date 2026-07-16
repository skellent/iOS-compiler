from fastapi import APIRouter, Depends, HTTPException

from modules.cursor       import Querys
from modules.db           import cursor
from modules.dependencies import usuario_actual
from modules.types        import Contacto, ContactoUpdate

router = APIRouter(prefix="/contactos", tags=["contactos"])


@router.post("", status_code=201)
def crear_contacto(data: Contacto, id_usuario: int = Depends(usuario_actual)):
    cursor.execute(Querys.INSERT_CONTACTO, (id_usuario, data.nombre, data.telefono, data.correo))
    cursor.commit()

    return {"Skellent": "Success!"}


@router.get("")
def listar_contactos(id_usuario: int = Depends(usuario_actual)):
    return cursor.execute(Querys.SELECT_CONTACTOS_POR_USUARIO, (id_usuario,))


@router.put("/{id_contacto}")
def editar_contacto(id_contacto: int, data: ContactoUpdate, id_usuario: int = Depends(usuario_actual)):
    campos: dict = data.model_dump(exclude_none=True)
    if not campos:
        raise HTTPException(status_code=400, detail="No se proporcionaron campos para actualizar")

    set_clause: str = ", ".join(f"{campo} = %s" for campo in campos)
    valores: tuple = tuple(campos.values()) + (id_contacto, id_usuario)

    cursor.execute(f"UPDATE contactos SET {set_clause} WHERE id = %s AND id_usuario = %s;", valores)
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    cursor.commit()

    filas: list[dict] = cursor.execute(
        "SELECT id, nombre, telefono, correo, confirmado FROM contactos WHERE id = %s;",
        (id_contacto,)
    )
    return filas[0]
