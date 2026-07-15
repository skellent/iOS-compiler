# `modules/cursor.py`

## Propósito

Este módulo define dos piezas que trabajan juntas para hablar con MariaDB:

- **`Querys`**: una clase que solo contiene constantes de cadena con las sentencias SQL usadas por la aplicación.
- **`Cursor`**: una clase que envuelve la conexión y el cursor de `mariadb`, exponiendo una API mínima (`execute`, `commit`, `close`) al resto del backend.

## Por qué separar las consultas SQL en `Querys`

Las cadenas SQL (`SHOW_TABLES`, `INSERT_USUARIO`, etc.) viven como atributos de clase en `Querys` en vez de estar escritas directamente donde se usan (por ejemplo, dentro de los endpoints de `main.py`). Esto evita que el texto SQL quede disperso y duplicado por el código de negocio, y hace que cada consulta tenga un nombre legible (`Querys.INSERT_USUARIO`) en el punto de uso. Si una consulta cambia, se edita en un solo lugar.

Nótese que `INSERT_USUARIO` usa marcadores de posición `%s` en vez de interpolar valores directamente en la cadena. Esto es intencional y es la defensa principal contra inyección SQL: los valores reales se pasan como tupla al método `execute`, y es el conector `mariadb` quien los escapa correctamente antes de enviarlos al servidor.

## Por qué envolver la conexión en una clase `Cursor`

`mariadb.connect()` y el manejo de un cursor crudo requieren varios pasos repetitivos (abrir conexión, crear cursor, manejar errores de conexión, hacer commit, cerrar). Envolver esto en `Cursor` permite que el resto de la aplicación (`main.py`) trabaje con tres métodos simples sin preocuparse por los detalles del driver:

### `__init__`

Recibe las credenciales ya resueltas (ver `credenciales.md`) y abre la conexión. Si la conexión falla, se captura `mariadb.Error`, se imprime el motivo y se llama a `sys.exit(1)`. Esta es una decisión deliberada de **fallar rápido**: como el `Cursor` se instancia a nivel de módulo en `main.py` (es decir, al arrancar la aplicación, no en cada request), si la base de datos no está disponible el proceso completo debe detenerse en vez de arrancar en un estado a medias donde cada endpoint fallaría de forma menos clara más adelante.

El cursor se crea con `dictionary=True`, de modo que cada fila devuelta es un `dict` (columna → valor) en vez de una tupla posicional. Esto hace que los resultados sean directamente serializables a JSON por FastAPI y más legibles/mantenibles que depender del orden de las columnas.

### `execute`

Ejecuta cualquier consulta parametrizada y devuelve `self.cursor.fetchall()`. El método captura `mariadb.ProgrammingError` alrededor de `fetchall()` porque no todas las consultas devuelven filas: un `SELECT` sí, pero un `INSERT` no tiene un result set que recuperar, y el conector lanza esa excepción al intentarlo. Envolver ambos casos en un único método evita tener que exponer dos variantes (`query` vs `execute`) al resto del código; quien llama simplemente ignora el valor de retorno cuando ejecuta una escritura.

### `commit` y `close`

Métodos delgados que delegan directamente en la conexión subyacente. Se exponen explícitamente porque MariaDB, como la mayoría de motores SQL, no persiste cambios de escritura hasta que se confirma la transacción — de ahí que `main.py` llame a `cursor.commit()` después de cada `INSERT` (ver `main.md`).

## Relación con el resto del backend

`main.py` crea una única instancia de `Cursor` al arrancar la aplicación (no una por request) y la reutiliza para todos los endpoints. Es un diseño simple, adecuado para el estado actual del proyecto, pero implica que toda la aplicación comparte una sola conexión a la base de datos.
