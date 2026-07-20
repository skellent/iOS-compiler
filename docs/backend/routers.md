# `modules/routers/` — Endpoints de la API

Este directorio contiene toda la lógica de negocio de la API, repartida en cuatro archivos según el recurso al que pertenecen. A diferencia de los demás módulos del backend, que tienen un `.md` propio, estos se documentan juntos en un solo archivo — el mismo criterio que ya se usa en `sql.md` para agrupar los tres scripts de `querys/`, porque son piezas que solo tienen sentido leídas en conjunto (comparten las mismas dependencias y el mismo patrón).

Cada archivo define un `APIRouter` con un prefijo fijo y lo expone como `router`, que `main.py` monta con `app.include_router(...)` (ver `main.md`):

| Archivo         | Prefijo       | Endpoints |
|------------------|---------------|-----------|
| `auth.py`        | `/auth`       | `POST /registro`, `POST /login` |
| `usuarios.py`    | `/usuarios`   | `GET /me`, `PUT /me` |
| `contactos.py`   | `/contactos`  | `POST /`, `GET /`, `GET /confirmar/{token}`, `PUT /{id_contacto}` |
| `alertas.py`     | `/alertas`    | `POST /` |

## Por qué `APIRouter` y no todo junto en `main.py`

`APIRouter` es la pieza de FastAPI pensada exactamente para este problema: permite declarar endpoints en un archivo separado de donde vive la instancia principal `FastAPI()`, con su propio prefijo de ruta y sus propios tags (usados para agrupar visualmente los endpoints en la documentación automática de `/docs`), y después "pegarlos" a la aplicación real con `include_router`. Es lo que le permitió a `main.py` encogerse a apenas diez líneas (ver `main.md`) a pesar de que la API creció de un endpoint a nueve.

## `auth.py`

```python
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
```

Agrupa las dos únicas rutas que **no** requieren estar autenticado — tiene sentido, porque su propósito es, justamente, conseguir las credenciales (`/registro`) o el token (`/login`) que todo lo demás va a exigir.

### `POST /auth/registro`

Es el endpoint original del proyecto (antes vivía en `main.py` como `POST /registrar/usuario`), movido aquí sin cambiar su lógica de fondo, más una corrección importante: el bloque `try/except RegistroDuplicadoError`. Antes, registrar un `telefono` o `correo` ya existente (ambos son `UNIQUE` en la tabla `usuarios`, ver `sql.md`) hacía que MariaDB rechazara el `INSERT` con un error que no se capturaba en ningún lado, y ese error terminaba subiendo hasta FastAPI como un `500 Internal Server Error` — la peor respuesta posible para lo que en realidad es un error del cliente (mandó un dato que colisiona con uno existente), no del servidor. `RegistroDuplicadoError` (ver `cursor.md`) es la traducción de ese error específico de MariaDB a algo que este archivo puede entender sin importar `mariadb`, y que se convierte en un `409 Conflict` — el código HTTP pensado exactamente para "esta petición no se pudo completar porque entra en conflicto con el estado actual del recurso".

El resto del flujo es igual al que documentaba `main.md` antes de este cambio: `Guard.Crear` (ver `guard.md`) hashea la contraseña antes de que el texto plano toque la base de datos, y `status_code=201` se declara explícitamente porque la operación crea un recurso nuevo.

### `POST /auth/login`

Es el endpoint completamente nuevo de este archivo. El flujo:

1. `Querys.SELECT_USUARIO_POR_CORREO` (ver `cursor.md`) busca al usuario por su correo, trayendo también `contraseña_hash` — la única consulta del proyecto que expone ese campo, porque es la única que lo necesita.
2. `if not filas or not Guard.Validar(...)`: se comprueba, en una sola condición, tanto "el correo no existe" (`filas` vacío) como "la contraseña no coincide" (`Guard.Validar` devuelve `False`, ver `guard.md`). Ambos casos responden exactamente el mismo `401 Unauthorized` con el mismo mensaje genérico ("Correo o contraseña incorrectos"), a propósito: si el mensaje fuera distinto según cuál de los dos falló, cualquiera podría usar el endpoint para averiguar qué correos están registrados en el sistema probando uno por uno (un ataque de enumeración de usuarios). Nótese el uso de `not filas or not Guard.Validar(...)`: gracias al cortocircuito (short-circuit) de `or` en Python, si `filas` está vacío, `Guard.Validar` ni se llama — evita un `IndexError` al intentar acceder a `filas[0]` cuando no hay ninguna fila.
3. Si todo coincide, `Token.Crear(filas[0]["id"])` (ver `token.md`) firma un JWT con el `id` de ese usuario, y se devuelve junto con `token_type: "bearer"` — el nombre estándar del esquema que el cliente debe anteponer al mandar el token de vuelta (`Authorization: Bearer <token>`, ver `dependencies.md`).

Este endpoint no requiere `Depends(usuario_actual)`, por razones obvias: es el punto de entrada que produce el token, no puede exigir uno para funcionar.

## `usuarios.py`

```python
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
```

Agrupa las operaciones sobre el usuario autenticado. Nótese que ninguna de las dos rutas recibe un `id` por parámetro de URL (no existe `/usuarios/{id}`): ambas usan `/me`, un patrón deliberado en el que "de quién son los datos" nunca lo decide el cliente escribiendo un número en la URL, sino el token (`Depends(usuario_actual)`, ver `dependencies.md`). Esto hace estructuralmente imposible que un usuario pida o edite los datos de otro simplemente cambiando un número — no hay ningún número que cambiar.

### `GET /usuarios/me`

El más simple de los dos: trae la fila del usuario autenticado con `Querys.SELECT_USUARIO_POR_ID` (ver `cursor.md`), que a propósito no incluye `contraseña_hash` entre las columnas que selecciona — no hay riesgo de devolver el hash por accidente porque ni siquiera se le pide a la base de datos.

### `PUT /usuarios/me` y la construcción dinámica del `UPDATE`

Este es el endpoint más elaborado de los siete, porque resuelve el problema de las **ediciones parciales**: el cliente puede mandar cualquier subconjunto de `nombre`, `telefono`, `correo`, `contraseña` (ver `types.md`, `UsuarioUpdate`), y el `UPDATE` generado solo debe tocar esas columnas, dejando el resto intacto. Paso a paso:

1. `data.model_dump(exclude_none=True)` convierte el modelo Pydantic en un `dict`, descartando cualquier campo que haya quedado en `None` (es decir, que el cliente no envió). Si el resultado es un diccionario vacío, no hay nada que actualizar y se responde `400 Bad Request` — no tendría sentido ejecutar un `UPDATE ... SET` sin columnas.
2. Si el cliente decidió cambiar su `contraseña`, se la reemplaza por su hash con `Guard.Crear` (ver `guard.md`) **antes** de construir la consulta, exactamente igual que en el registro: el texto plano nunca llega a formar parte del SQL.
3. `_COLUMNA_POR_CAMPO` traduce el nombre del campo del modelo Pydantic (`contraseña`) al nombre real de la columna en la tabla (`contraseña_hash`, ver `sql.md`) — son distintos a propósito, para que el modelo hable en los mismos términos que el resto de la API (`contraseña`) sin filtrar el detalle de que, en la base de datos, ese valor es un hash.
4. `set_clause` arma la porción `columna = %s, columna = %s, ...` de la consulta, solo con los campos presentes en `campos`. **Esto es seguro** aunque estén concatenando texto directamente en la cadena SQL: lo que se concatena son *nombres de columna*, que solo pueden salir de las claves fijas de `_COLUMNA_POR_CAMPO` (a su vez derivadas de los campos declarados en `UsuarioUpdate`, ver `types.md`) — nunca de un valor arbitrario escrito por quien llama a la API. Los *valores* reales, que sí vienen del cliente y sí podrían ser maliciosos, siguen viajando parametrizados como `%s` dentro de `valores`, igual que en cualquier otra consulta de este proyecto.
5. Si el `UPDATE` viola la restricción `UNIQUE` de `telefono` o `correo` (por ejemplo, el usuario intenta cambiar su correo a uno que ya usa otra cuenta), `Cursor.execute` lo traduce a `RegistroDuplicadoError` (ver `cursor.md`) y el endpoint responde `409`, con el mismo criterio que el registro.
6. Tras el `commit`, se vuelve a leer la fila actualizada con `SELECT_USUARIO_POR_ID` y se devuelve completa, para que el cliente no tenga que adivinar el estado final combinando lo que mandó con lo que ya tenía.

## `contactos.py`

```python
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
```

Es el CRUD de contactos de emergencia, más el endpoint de confirmación agregado junto con `modules/correo.py` (ver `correo.md` para el flujo completo). Los tres endpoints protegidos (`POST`, `GET ""`, `PUT`) comparten `Depends(usuario_actual)` y con eso alcanza para que ninguno permita operar sobre contactos ajenos — el `id_usuario` nunca lo manda el cliente, siempre sale del token. `GET /confirmar/{token}` es la excepción deliberada, ver su propia sección más abajo.

A diferencia de `usuarios.py`, acá `_COLUMNA_POR_CAMPO` no hizo falta: los tres campos de `ContactoUpdate` (`nombre`, `telefono`, `correo`, ver `types.md`) ya se llaman igual que sus columnas en la tabla `contactos` (ver `sql.md`), así que `set_clause` usa el nombre del campo directamente.

### `POST /contactos` y `GET /contactos`

Sin sorpresas en el `INSERT`/`SELECT`: siguen el mismo patrón parametrizado que el resto del proyecto. Nótese que las rutas se declaran como `""` (cadena vacía), no `"/"` — con el `prefix="/contactos"` del router, `""` resuelve a `/contactos` exactamente, mientras que `"/"` hubiera generado `/contactos/` con la barra final, una URL distinta a efectos de HTTP que hubiera obligado a los clientes a acertar con la barra o lidiar con una redirección.

Lo que sí es nuevo en `POST /contactos`: si el contacto se creó con un `correo`, se dispara el envío de un correo de confirmación en segundo plano (`background_tasks.add_task(Correo.Enviar, ...)`, ver `correo.md` para por qué en segundo plano y no `await` directo). `cursor.lastrowid` (ver `cursor.md`) da el `id` del contacto recién insertado, necesario para generar el token de confirmación con `Token.CrearConfirmacionContacto` (ver `token.md`) antes de poder armar el link. También se hace un `SELECT_USUARIO_POR_ID` extra para obtener el `nombre` de quien está agregando el contacto — se usa en el cuerpo del correo ("Fulano te agregó como contacto de emergencia"), y no había forma de evitarlo sin cambiar la firma de `usuario_actual` (ver `dependencies.md`), que deliberadamente solo devuelve el `id`, no la fila completa. Si `data.correo` es `None` (recordar que es el único campo opcional de `Contacto`, ver `types.md`), no se manda nada — no hay forma de confirmar un contacto por correo si no se tiene un correo, y ese contacto simplemente queda con `confirmado = FALSE` indefinidamente hasta que el proyecto sume otro canal de confirmación (SMS, por ejemplo, cuando se resuelva la integración con Twilio pendiente en `TASK.md`).

### `GET /contactos/confirmar/{token}`

Es, junto con las dos rutas de `auth.py`, uno de los pocos endpoints del backend que **no** exige `Depends(usuario_actual)` — y por la misma razón que ellas: a este endpoint se llega haciendo clic en un link dentro de un correo, no navegando la app ya logueado, así que quien hace la petición no tiene (ni puede tener) un JWT de sesión. La autenticación de este endpoint no es "quién sos", sino "¿tenés el token de confirmación correcto, generado específicamente para este contacto?" — de ahí que use `Token.ValidarConfirmacionContacto` (ver `token.md`) en vez de la dependencia estándar.

El flujo es deliberadamente igual de simple que el resto del CRUD: `Token.ValidarConfirmacionContacto(token)` devuelve el `id_contacto` si el token es válido y del tipo correcto, o `None` si no (token corrupto, expirado, o de otro tipo — por ejemplo, un JWT de sesión). Con el `id_contacto` en mano, `Querys.CONFIRMAR_CONTACTO` (ver `cursor.md`) actualiza esa fila, y `cursor.rowcount == 0` cubre el caso "el token era válido pero ese `id_contacto` ya no existe" (por ejemplo, si el contacto fue borrado — aunque hoy no existe un `DELETE /contactos/{id}`, se deja la comprobación por si se agrega en el futuro, mismo criterio defensivo que ya usa `PUT /{id_contacto}`).

### `PUT /contactos/{id_contacto}` y por qué usa `rowcount` en vez de un `SELECT` previo

Este es el único endpoint del proyecto que necesita responder `404 Not Found`, y lo hace de una forma particular: en vez de primero hacer un `SELECT` para comprobar "¿existe este contacto y es mío?" y después el `UPDATE`, ejecuta directamente el `UPDATE` con `WHERE id = %s AND id_usuario = %s` y revisa cuántas filas afectó con `cursor.rowcount` (ver `cursor.md`). Si el `id_contacto` no existe, o existe pero pertenece a otro usuario, la cláusula `WHERE` no encuentra ninguna fila para actualizar y `rowcount` da `0` — y ambos casos (no existe / no es tuyo) devuelven el mismo `404`, sin distinguirlos en el mensaje, por la misma razón de no dar pistas que ya se explicó para el login: confirmarle a alguien que "el contacto 7 existe pero no es tuyo" revela más de lo necesario. Hacerlo en una sola consulta, además, evita una condición de carrera (que el contacto sea borrado o reasignado entre el `SELECT` de verificación y el `UPDATE` posterior) que sí podría ocurrir con el enfoque de dos pasos.

## `alertas.py`

```python
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
```

Es el endpoint que corresponde a activar el botón de pánico en sí — el propósito final del proyecto (ver `sql.md`, sección `alertas`). Un solo endpoint, sin `GET`/`PUT` propios todavía: hoy nadie necesita listar ni editar alertas pasadas, solo crearlas.

### Por qué se notifica solo a los contactos **confirmados**

`Querys.SELECT_CONTACTOS_CONFIRMADOS_POR_USUARIO` (ver `cursor.md`), no `SELECT_CONTACTOS_POR_USUARIO`, es la consulta que decide a quién notificar. Esto no es una limitación técnica sino la razón de ser de la columna `confirmado` (ver `sql.md`, `guard.md`): agregar a alguien como contacto de emergencia no le da automáticamente el consentimiento de recibir alertas en su nombre, y esa persona ya tuvo la oportunidad de confirmarlo haciendo clic en el link que le llegó por correo al ser agregada (`POST /contactos`, ver más arriba). Un contacto que nunca confirmó simplemente no aparece en esta consulta y no recibe nada — ni siquiera se intenta.

### Por qué `Correo.EnviarMasivo` y no `Correo.Enviar` en un loop

A diferencia de `POST /contactos` (que siempre notifica a **un** destinatario, el contacto recién creado), `POST /alertas` puede necesitar notificar a **varios** contactos confirmados a la vez. Llamar a `Correo.Enviar` una vez por contacto abriría y cerraría una conexión SMTP distinta por cada uno; `Correo.EnviarMasivo` (ver `correo.md`) abre una única conexión y manda todos los correos de esa alerta a través de ella, además de garantizar que un contacto con una dirección inválida no le impida al resto recibir la notificación. Ver `correo.md` para el detalle completo de por qué esto importa específicamente acá (y no antes: hasta este endpoint, todo envío del proyecto era 1 a 1).

### Por qué en segundo plano, igual que la confirmación de contactos

El `INSERT` en `alertas` — el registro durable de que la alerta ocurrió — se confirma con `cursor.commit()` **antes** de intentar avisarle a nadie, y la respuesta `201` llega apenas eso termina. Encolar `Correo.EnviarMasivo` con `background_tasks.add_task` (en vez de `await` directo) significa que quien activó el botón de pánico no espera a que se manden N correos para saber que su alerta quedó registrada — algo particularmente importante acá, donde la app debería confirmarle al usuario que la alerta se disparó lo más rápido posible, sin que la latencia de Gmail (o un contacto con problemas de entrega) se interponga en el camino.

### `fecha_hora` en el correo no sale de una consulta a `alertas`

El contexto de la plantilla usa `datetime.now()` calculado en el momento de responder, no un `SELECT` de la fila recién insertada (cuyo `fecha_hora` lo pone `DEFAULT CURRENT_TIMESTAMP` en MariaDB, ver `sql.md`). Son, en la práctica, el mismo instante — no vale la pena una consulta extra solo para mostrar un valor que ya se conoce con precisión suficiente para un correo de notificación.

## Relación con el resto del backend

`main.py` importa los cuatro módulos de este directorio y monta sus routers con `include_router` (ver `main.md`). Todos dependen de `modules/db.py` (el `cursor` compartido), `modules/cursor.py` (`Querys` y, salvo `contactos.py`/`alertas.py`, `RegistroDuplicadoError`) y `modules/types.py` (los modelos Pydantic de cada petición); `usuarios.py`, `contactos.py` y `alertas.py` además dependen de `modules/dependencies.py` para exigir autenticación. `modules/guard.py` lo usan tanto `auth.py` (crear el hash al registrar, validarlo al loguear) como `usuarios.py` (crear el hash cuando el usuario cambia su propia contraseña); `modules/token.py` lo usa `auth.py` (emitir el JWT de sesión) y `contactos.py` (emitir y validar el token de confirmación, ver `token.md`) — `alertas.py` no lo necesita, porque no emite ni valida ningún token propio. `modules/correo.py` (ver `correo.md`) lo usan `contactos.py` (`Correo.Enviar`, 1 a 1) y `alertas.py` (`Correo.EnviarMasivo`, 1 a N).
