# `main.py`

## Propósito

Es el punto de entrada de la API: aquí se instancia la aplicación FastAPI, se establece la conexión a la base de datos y se declaran los endpoints HTTP. Es el módulo que `uvicorn` carga al ejecutar `uvicorn main:app` (ver README, sección "Preparar el Entorno").

## Inicialización a nivel de módulo

```python
credenciales: dict = obtener_credenciales()

cursor: Cursor = Cursor(
    credenciales['database']['user'],
    credenciales['database']['password'],
    credenciales['database']['host'],
    credenciales['database']['port'],
    credenciales['database']['database'],
)

app = FastAPI()
```

Antes de declarar cualquier endpoint, el módulo lee las credenciales (`credenciales.md`) y abre **una única conexión** a MariaDB envuelta en `Cursor` (`cursor.md`). Esto ocurre una sola vez, cuando el proceso arranca, no en cada petición HTTP. Es un diseño deliberadamente simple para el estado actual del proyecto: evita la complejidad de un pool de conexiones, a costa de que toda la aplicación comparta ese único objeto `cursor` en memoria durante toda su vida útil. Como se explica en `cursor.md`, si esta conexión falla al arrancar, el proceso completo termina (`sys.exit(1)`) en vez de servir una API que fallaría en cada request — se prefiere un fallo temprano y explícito a uno tardío y confuso.

## `GET /`

```python
@app.get("/")
def root():
    return {"Skellent": "You shouldn't be here, boy!" }
```

Es la ruta raíz de la API. No cumple una función de negocio: sirve como comprobación rápida de que el servidor está arriba y respondiendo (un endpoint de vida/"health check" informal), y de paso dificulta un poco la exploración casual de la API por parte de alguien que llegue a la raíz sin saber qué está mirando.

## `POST /registrar/usuario`

```python
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
```

Este es el único endpoint de negocio implementado hasta ahora: da de alta un nuevo usuario. El flujo, en orden, es:

1. **Validación de entrada**: el parámetro `data: Usuario` hace que FastAPI valide el cuerpo de la petición contra el modelo `Usuario` (`types.md`) antes de que esta función se ejecute siquiera. Si falta un campo o tiene el tipo equivocado, el cliente recibe un `422` automáticamente.
2. **Hashing de la contraseña**: `Guard.Crear(data.contraseña)` (`guard.md`) transforma la contraseña en texto plano recibida en un hash de bcrypt. Esto ocurre *antes* de tocar la base de datos: en ningún momento el texto plano llega a formar parte de la consulta SQL ni se persiste.
3. **Inserción parametrizada**: `cursor.execute` recibe la consulta `Querys.INSERT_USUARIO` (`cursor.md`) junto con una tupla de valores. Los valores se pasan por separado de la cadena SQL (no se interpolan con f-strings) precisamente para que el conector de MariaDB los escape correctamente y así evitar inyección SQL.
4. **Confirmación explícita**: `cursor.commit()` persiste la transacción. Sin esta llamada, el `INSERT` quedaría pendiente y se perdería si la conexión se cerrara.
5. **Código de estado `201`**: se declara explícitamente en el decorador (`status_code=201`) en vez de aceptar el `200` por defecto de FastAPI, porque semánticamente la operación crea un recurso nuevo (un usuario), y `201 Created` es el código HTTP pensado exactamente para eso.

## Qué falta (por ahora)

No hay endpoint de login, ni de gestión de contactos de emergencia, ni de registro de alertas, aunque el esquema de base de datos (`sql.md`) ya contempla las tablas `contactos` y `alertas`, y `Guard.Validar` (`guard.md`) ya existe pero no se usa todavía en ningún endpoint. Esto refleja el estado temprano del desarrollo: el registro de usuario es el primer flujo completo (API → validación → hashing → persistencia) y sienta el patrón que se espera repetir para el resto de la funcionalidad.
