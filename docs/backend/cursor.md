# `modules/cursor.py`

## Propósito

Este módulo define tres piezas que trabajan juntas para hablar con MariaDB:

- **`Querys`**: una clase que solo contiene constantes de cadena con las sentencias SQL usadas por la aplicación.
- **`Cursor`**: una clase que envuelve la conexión y el cursor de `mariadb`, exponiendo una API mínima (`execute`, `commit`, `close`, `rowcount`) al resto del backend.
- **`RegistroDuplicadoError`**: una excepción propia del proyecto que traduce un error específico de `mariadb` a algo que el resto del backend puede entender sin tener que conocer `mariadb`.

## Por qué separar las consultas SQL en `Querys`

Las cadenas SQL (`SHOW_TABLES`, `INSERT_USUARIO`, etc.) viven como atributos de clase en `Querys` en vez de estar escritas directamente donde se usan (por ejemplo, dentro de los endpoints de los routers, ver `routers.md`). Esto evita que el texto SQL quede disperso y duplicado por el código de negocio, y hace que cada consulta tenga un nombre legible (`Querys.INSERT_USUARIO`) en el punto de uso. Si una consulta cambia, se edita en un solo lugar.

Nótese que todas las consultas parametrizadas (`INSERT_USUARIO`, `SELECT_USUARIO_POR_CORREO`, `INSERT_CONTACTO`, etc.) usan marcadores de posición `%s` en vez de interpolar valores directamente en la cadena. Esto es intencional y es la defensa principal contra inyección SQL: los valores reales se pasan como tupla al método `execute`, y es el conector `mariadb` quien los escapa correctamente antes de enviarlos al servidor.

Las consultas de usuarios y contactos se agregaron a medida que se fue necesitando cada operación (ver `routers.md` para quién llama a cada una):

- `SELECT_USUARIO_POR_CORREO`: trae también `contraseña_hash`, algo que `SELECT_USUARIO_POR_ID` deliberadamente no hace. La primera la usa el login, que necesita el hash para compararlo con `Guard.Validar` (ver `guard.md`); la segunda la usa `GET /usuarios/me`, que nunca debería devolver el hash al cliente, así que ni siquiera se selecciona esa columna — es más simple no pedirle a quien arma la respuesta que recuerde excluir un campo, que directamente no traerlo de la base de datos.
- `INSERT_CONTACTO` y `SELECT_CONTACTOS_POR_USUARIO` no tienen una razón de diseño distinta a `INSERT_USUARIO`: siguen el mismo patrón, solo que sobre la tabla `contactos` (ver `sql.md`).
- `CONFIRMAR_CONTACTO` (`UPDATE contactos SET confirmado = TRUE WHERE id = %s;`) sí es una constante fija, a diferencia de las ediciones parciales de `usuarios.py`/`contactos.py` (ver más abajo): siempre toca la misma columna con el mismo valor fijo (`TRUE`), nunca un subconjunto variable de campos que dependa de qué mandó el cliente. Por eso encaja en `Querys` en vez de armarse dinámicamente en el router — es exactamente el mismo caso que `INSERT_USUARIO`, solo que es un `UPDATE` de un único campo constante. La usa `GET /contactos/confirmar/{token}` (ver `routers.md`, `correo.md`).
- `SELECT_CONTACTOS_CONFIRMADOS_POR_USUARIO` (`SELECT nombre, telefono, correo FROM contactos WHERE id_usuario = %s AND confirmado = TRUE;`) es una variante de `SELECT_CONTACTOS_POR_USUARIO` con un `WHERE` más estricto y menos columnas: no trae `id` (nadie necesita editar estos contactos, solo mandarles un correo) y filtra por `confirmado = TRUE`. La usa `POST /alertas` (ver `routers.md`) para decidir a quién notificar cuando se dispara una alerta — deliberadamente distinta de `SELECT_CONTACTOS_POR_USUARIO` (que sí trae todos los contactos, confirmados o no, para `GET /contactos`) porque son dos preguntas distintas: "¿cuáles son mis contactos?" contra "¿a cuáles de mis contactos les puedo mandar una alerta?". Ver `correo.md` para por qué esa distinción importa.
- `INSERT_ALERTA` (`INSERT INTO alertas (id_usuario, latitud, longitud) VALUES (%s, %s, %s);`) sigue el mismo patrón que `INSERT_USUARIO`/`INSERT_CONTACTO`: no incluye `fecha_hora`, que la tabla completa sola con `DEFAULT CURRENT_TIMESTAMP` (ver `sql.md`).
- No existe un `UPDATE_USUARIO` ni `UPDATE_CONTACTO` como constante fija en `Querys`. A diferencia de un `INSERT` (que siempre toca las mismas columnas), una edición parcial (`PUT /usuarios/me`, `PUT /contactos/{id}`) solo debe tocar los campos que el cliente efectivamente envió — si `Querys` tuviera una única constante `UPDATE_USUARIO` con las cuatro columnas fijas, cada edición forzaría a reescribir columnas que el usuario no quiso cambiar. Por eso esas dos consultas se arman dinámicamente dentro de los routers correspondientes (ver `routers.md`), concatenando solo los nombres de columna que correspondan a los campos presentes. Esto sigue siendo seguro porque los nombres de columna salen de una lista fija conocida de antemano (los campos del modelo Pydantic, ver `types.md`), nunca de texto arbitrario escrito por quien llama a la API — lo único que viaja parametrizado con `%s` son los valores, igual que en el resto de las consultas.

## Por qué envolver la conexión en una clase `Cursor`

`mariadb.connect()` y el manejo de un cursor crudo requieren varios pasos repetitivos (abrir conexión, crear cursor, manejar errores de conexión, hacer commit, cerrar). Envolver esto en `Cursor` permite que el resto de la aplicación (`main.py`) trabaje con tres métodos simples sin preocuparse por los detalles del driver:

### `__init__`

Recibe las credenciales ya resueltas (ver `credenciales.md`) y abre la conexión. Si la conexión falla, se captura `mariadb.Error`, se imprime el motivo y se llama a `sys.exit(1)`. Esta es una decisión deliberada de **fallar rápido**: como el `Cursor` se instancia a nivel de módulo en `main.py` (es decir, al arrancar la aplicación, no en cada request), si la base de datos no está disponible el proceso completo debe detenerse en vez de arrancar en un estado a medias donde cada endpoint fallaría de forma menos clara más adelante.

El cursor se crea con `dictionary=True`, de modo que cada fila devuelta es un `dict` (columna → valor) en vez de una tupla posicional. Esto hace que los resultados sean directamente serializables a JSON por FastAPI y más legibles/mantenibles que depender del orden de las columnas.

### `execute`

```python
def execute(self, query: str, params: tuple = ()) -> list[dict]:
    try:
        self.cursor.execute(query, params)
    except mariadb.IntegrityError as e:
        raise RegistroDuplicadoError(str(e)) from e
    try:
        return self.cursor.fetchall()
    except mariadb.ProgrammingError:
        return []
```

Ejecuta cualquier consulta parametrizada y devuelve `self.cursor.fetchall()`. El segundo `try` captura `mariadb.ProgrammingError` alrededor de `fetchall()` porque no todas las consultas devuelven filas: un `SELECT` sí, pero un `INSERT` o un `UPDATE` no tienen un result set que recuperar, y el conector lanza esa excepción al intentarlo. Envolver ambos casos en un único método evita tener que exponer dos variantes (`query` vs `execute`) al resto del código; quien llama simplemente ignora el valor de retorno cuando ejecuta una escritura.

El primer `try` es nuevo y resuelve un bug real: antes, insertar un usuario con un `telefono` o `correo` que ya existía (ambos son `UNIQUE` en la tabla `usuarios`, ver `sql.md`) hacía que `mariadb` lanzara un `mariadb.IntegrityError` sin capturar, que FastAPI convertía en un `500 Internal Server Error` genérico — el peor tipo de respuesta posible para un caso que en realidad es previsible y del cliente (mandó datos que chocan con algo que ya existe, no un fallo del servidor). Ahora `execute` intercepta ese error específico y lo relanza como `RegistroDuplicadoError`, una excepción propia del proyecto definida arriba en este mismo archivo:

```python
class RegistroDuplicadoError(Exception):
    pass
```

La razón de definirla acá, y no en el router que la termina usando (ver `routers.md`), es que `cursor.py` es el único archivo del backend que importa `mariadb` directamente — es, a propósito, el único punto donde el proyecto sabe que la base de datos es MariaDB y no otra cosa. Si los routers tuvieran que capturar `mariadb.IntegrityError` ellos mismos, tendrían que importar `mariadb` también, filtrando un detalle de infraestructura (qué motor de base de datos se usa) a la capa que solo debería preocuparse por HTTP. Con `RegistroDuplicadoError` como intermediario, un router puede hacer `except RegistroDuplicadoError` y responder `409 Conflict` sin saber ni que `mariadb` existe. Si el día de mañana el proyecto migrara a otro motor de base de datos, solo este archivo tendría que cambiar.

### `rowcount`

```python
@property
def rowcount(self) -> int:
    return self.cursor.rowcount
```

Expone cuántas filas afectó la última consulta ejecutada. Se agregó porque `PUT /contactos/{id}` (ver `routers.md`) necesita distinguir dos situaciones que, de otra forma, se ven idénticas desde afuera: "el `UPDATE` corrió pero no tocó ninguna fila porque ese `id` no existe o no es tuyo" (debería responder `404`) versus "el `UPDATE` corrió y modificó la fila" (`200`). Como `Querys` filtra esas ediciones por `WHERE id = %s AND id_usuario = %s` (para que nadie pueda editar el contacto de otra persona, ver `sql.md`), un `rowcount` de `0` es exactamente la señal de "no encontrado o no autorizado" — y como no queremos revelarle a quien hace la petición cuál de las dos cosas fue (para no confirmarle que existe un contacto con ese `id` perteneciente a otra persona), ambos casos devuelven el mismo `404`.

Se implementó como `@property` (no como método `rowcount()`) porque, conceptualmente, no es una acción que se manda a ejecutar sino un dato que ya existe apenas terminó la última consulta — leerlo con `cursor.rowcount` en vez de `cursor.rowcount()` refleja mejor esa idea.

### `lastrowid`

```python
@property
def lastrowid(self) -> int:
    return self.cursor.lastrowid
```

Mismo criterio que `rowcount`: un dato ya disponible apenas terminó el último `INSERT`, expuesto como propiedad de solo lectura. Se agregó porque `POST /contactos` (ver `routers.md`) necesita el `id` del contacto recién creado para generar su token de confirmación (`Token.CrearConfirmacionContacto`, ver `token.md`) — y `INSERT_CONTACTO` no devuelve filas (es un `INSERT`, no un `SELECT`), así que la única forma de conocer ese `id` sin hacer una consulta extra es preguntarle al cursor cuál fue el último `AUTO_INCREMENT` que generó, inmediatamente después del `INSERT` y antes de cualquier otra consulta que pudiera pisarlo.

### `commit` y `close`

Métodos delgados que delegan directamente en la conexión subyacente. Se exponen explícitamente porque MariaDB, como la mayoría de motores SQL, no persiste cambios de escritura hasta que se confirma la transacción — de ahí que los routers llamen a `cursor.commit()` después de cada `INSERT` o `UPDATE` (ver `routers.md`).

## Relación con el resto del backend

`modules/db.py` (ver `db.md`) crea la única instancia de `Cursor` al arrancar la aplicación (no una por request) y todos los routers la importan desde ahí para reutilizarla. Es un diseño simple, adecuado para el estado actual del proyecto, pero implica que toda la aplicación comparte una sola conexión a la base de datos.
