from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from modules.correo       import Correo
from modules.credenciales import obtener_credenciales
from modules.cursor       import Querys
from modules.db           import cursor
from modules.dependencies import usuario_actual
from modules.token        import Token
from modules.types        import Contacto, ContactoUpdate

router = APIRouter(prefix="/contactos", tags=["contactos"])

_URL_BASE: str = obtener_credenciales()['api_base_url']


@router.post("", status_code=201)
def crear_contacto(data: Contacto, background_tasks: BackgroundTasks, id_usuario: int = Depends(usuario_actual)):
    cursor.execute(Querys.INSERT_CONTACTO, (id_usuario, data.nombre, data.telefono, data.correo))
    cursor.commit()
    id_contacto: int = cursor.lastrowid

    if data.correo:
        filas: list[dict] = cursor.execute(Querys.SELECT_USUARIO_POR_ID, (id_usuario,))
        token: str = Token.CrearConfirmacionContacto(id_contacto)
        background_tasks.add_task(
            Correo.Enviar,
            data.correo,
            "Confirmá que sos un contacto de emergencia",
            "confirmacion_contacto",
            {
                "nombre_contacto":  data.nombre,
                "nombre_usuario":   filas[0]["nombre"],
                "url_confirmacion": f"{_URL_BASE}/contactos/confirmar/{token}",
            },
        )

    return {"Skellent": "Success!"}


@router.get("")
def listar_contactos(id_usuario: int = Depends(usuario_actual)):
    return cursor.execute(Querys.SELECT_CONTACTOS_POR_USUARIO, (id_usuario,))


@router.get("/confirmar/{token}")
def confirmar_contacto(token: str):
    id_contacto: int | None = Token.ValidarConfirmacionContacto(token)
    if id_contacto is None:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    cursor.execute(Querys.CONFIRMAR_CONTACTO, (id_contacto,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    cursor.commit()

    return {"mensaje": "Contacto confirmado exitosamente"}


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
