from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends

from modules.correo       import Correo
from modules.cursor       import Querys
from modules.db           import cursor
from modules.dependencies import usuario_actual
from modules.types        import Alerta

router = APIRouter(prefix="/alertas", tags=["alertas"])


@router.post("", status_code=201)
def crear_alerta(data: Alerta, background_tasks: BackgroundTasks, id_usuario: int = Depends(usuario_actual)):
    cursor.execute(Querys.INSERT_ALERTA, (id_usuario, data.latitud, data.longitud))
    cursor.commit()

    filas_usuario: list[dict] = cursor.execute(Querys.SELECT_USUARIO_POR_ID, (id_usuario,))
    contactos: list[dict] = cursor.execute(Querys.SELECT_CONTACTOS_CONFIRMADOS_POR_USUARIO, (id_usuario,))

    destinatarios: list[tuple[str, dict]] = [
        (
            contacto["correo"],
            {
                "nombre_contacto":  contacto["nombre"],
                "nombre_usuario":   filas_usuario[0]["nombre"],
                "telefono_usuario": filas_usuario[0]["telefono"],
                "fecha_hora":       datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "latitud":          data.latitud,
                "longitud":         data.longitud,
                "url_mapa":         f"https://www.google.com/maps?q={data.latitud},{data.longitud}",
            },
        )
        for contacto in contactos if contacto["correo"]
    ]

    if destinatarios:
        background_tasks.add_task(
            Correo.EnviarMasivo,
            f"Alerta de pánico de {filas_usuario[0]['nombre']}",
            "alerta_panico",
            destinatarios,
        )

    return {"Skellent": "Success!"}
