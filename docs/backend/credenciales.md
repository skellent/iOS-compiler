# `modules/credenciales.py`

## Propósito

Este módulo centraliza la lectura de todas las credenciales sensibles que el backend necesita para funcionar (por ahora, las de la base de datos; a futuro, las de la API externa que dispara las alertas). Expone una única función, `obtener_credenciales()`, que devuelve un diccionario con esa información.

## Por qué existe como módulo aparte

Las credenciales (usuario, contraseña, host, etc.) no se escriben en el código fuente ni se versionan en git. En su lugar, viven en un archivo `.env` (ver `backend/.envexample` para la plantilla) que `python-dotenv` carga en tiempo de ejecución mediante `load_dotenv()`. Aislar esta lectura en un módulo propio tiene dos motivos:

- **Un solo punto de entrada**: si mañana cambia el mecanismo de configuración (por ejemplo, pasar de variables de entorno a un gestor de secretos), solo hay que tocar este archivo, no cada lugar del código que necesita una credencial.
- **Separar configuración de lógica de negocio**: `main.py` no necesita saber *cómo* se obtienen las credenciales, solo que puede pedirlas con una llamada a esta función.

## Estructura del diccionario devuelto

```python
{
    "database": {
        "user":     ...,
        "password": ...,
        "host":     ...,
        "port":     ...,  # convertido explícitamente a int
        "database": ...,
    },
    "api": { # todavía no es la estructura final de la API de terceros
        "Auth": None,
        "Key":  None,
    },
    "jwt": {
        "secret_key": ...,
    }
}
```

La sección `database` mapea directamente a los parámetros que `mariadb.connect()` espera (ver `modules/cursor.py`), y se arma leyendo las variables `USERNAME`, `PASSWORD`, `HOST`, `PORT` y `DATABASE` del entorno. Nótese que `PORT` se convierte explícitamente con `int(...)`, ya que todas las variables de entorno llegan como cadenas de texto y el conector de MariaDB espera un puerto numérico.

La sección `api` está presente pero sin usar todavía (`Auth` y `Key` valen `None`). Es un marcador de posición intencional: el proyecto tiene planeado un servicio externo para el envío de alertas (SMS, notificaciones push, etc.) que requerirá sus propias credenciales, y se dejó la forma del diccionario lista para no tener que reestructurar `obtener_credenciales()` cuando ese desarrollo comience.

La sección `jwt` sí está en uso: `secret_key` lee la variable de entorno `JWT_SECRET_KEY`, la clave simétrica con la que `modules/token.py` firma y verifica los JSON Web Tokens del login (ver `token.md`). Se agregó a este diccionario en vez de leerse directamente con `os.getenv` dentro de `token.py` para no romper el patrón ya establecido: todo lo que el backend necesita del entorno pasa por esta única función, así que si el día de mañana el secreto de JWT tuviera que venir de un gestor de secretos en vez de un `.env`, solo este archivo cambiaría. A diferencia de `database`, no hace falta ninguna conversión de tipo: `JWT_SECRET_KEY` se usa tal cual, como la cadena de texto que es.

Como con cualquier otra credencial de este diccionario, `JWT_SECRET_KEY` vive únicamente en `.env` (fuera de git) y su plantilla está documentada en `.envexample`. Si se filtrara, quien la obtenga podría firmar tokens válidos para cualquier `id_usuario` que quisiera — es, en ese sentido, tan sensible como la contraseña de la base de datos.

## Relación con el resto del backend

Ya no es solo `main.py` quien consume este módulo. `modules/db.py` (ver `db.md`) llama a `obtener_credenciales()` una sola vez, al arrancar la aplicación, y usa la sección `database` del resultado para construir el `Cursor` de conexión. `modules/token.py` (ver `token.md`) también la llama, a nivel de módulo, para leer `jwt.secret_key` una única vez y guardarlo en una variable privada del módulo en vez de releerlo en cada `Token.Crear`/`Token.Validar`. Como `load_dotenv()` no falla si el archivo `.env` no existe, un despliegue sin ese archivo simplemente producirá valores `None` que luego harán fallar la conexión a MariaDB en `Cursor.__init__` (ver `cursor.md`) o la firma de tokens en `token.py`, en lugar de un error más descriptivo en este punto.
