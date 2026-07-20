# `modules/types.py`

## Propósito

Este módulo define los modelos de datos (`pydantic.BaseModel`) que describen la forma que deben tener los datos que entran al backend a través de la API. Empezó con un único modelo (`Usuario`) y ahora tiene seis, uno por cada forma distinta de dato que un endpoint necesita recibir:

```python
class Usuario(BaseModel):
    nombre:     str
    telefono:   str
    correo:     str
    contraseña: str

class UsuarioLogin(BaseModel):
    correo:     str
    contraseña: str

class UsuarioUpdate(BaseModel):
    nombre:     str | None = None
    telefono:   str | None = None
    correo:     str | None = None
    contraseña: str | None = None

class Contacto(BaseModel):
    nombre:   str
    telefono: str
    correo:   str | None = None

class ContactoUpdate(BaseModel):
    nombre:   str | None = None
    telefono: str | None = None
    correo:   str | None = None

class Alerta(BaseModel):
    latitud:  float
    longitud: float
```

## Por qué Pydantic y no un `dict` simple

FastAPI usa las anotaciones de tipo de estas clases para tres cosas a la vez, sin código adicional:

1. **Validación automática**: si una petición a `POST /auth/registro` llega sin alguno de estos campos, o con un tipo incorrecto, FastAPI responde automáticamente con un `422 Unprocessable Entity` antes de que el código del endpoint (ver `routers.md`) llegue a ejecutarse. Esto evita tener que escribir validaciones manuales (`if "nombre" not in data: ...`) en cada endpoint.
2. **Documentación automática**: FastAPI genera el esquema OpenAPI/Swagger (`/docs`) a partir de estas clases, así que el modelo sirve simultáneamente como contrato de la API y como documentación interactiva.
3. **Tipado en el resto del código**: dentro del endpoint, `data: Usuario` permite acceder a `data.nombre`, `data.telefono`, etc. con autocompletado y chequeo de tipos, en vez de indexar un diccionario sin garantías (`data["nombre"]`).

## Por qué `Usuario`, `Contacto` y `Alerta` tienen todos los campos obligatorios

Ninguno de los campos de `Usuario`, `Contacto` (salvo `correo`, ver más abajo) o `Alerta` tiene un valor por defecto ni está envuelto en `| None`, lo que en Pydantic significa que son requeridos. Esto es consistente con el esquema de las tablas `usuarios`, `contactos` y `alertas` (ver `sql.md`), donde las columnas equivalentes son `NOT NULL`: no tiene sentido que la API acepte un registro incompleto si la base de datos lo va a rechazar de todas formas, así que la validación se adelanta a la capa de entrada. `Contacto.correo` es la única excepción, y es intencional: refleja que `contactos.correo` es la única columna nullable de esa tabla (un contacto de emergencia puede ser alcanzable solo por teléfono). `Alerta` no tiene un campo opcional equivalente: no existe un escenario donde tenga sentido registrar una alerta sin ubicación, así que `latitud` y `longitud` son obligatorios los dos, igual que en la tabla.

## Por qué `UsuarioUpdate` y `ContactoUpdate` tienen todos los campos opcionales

```python
class UsuarioUpdate(BaseModel):
    nombre:     str | None = None
    telefono:   str | None = None
    correo:     str | None = None
    contraseña: str | None = None
```

Estos dos modelos existen para las ediciones parciales (`PUT /usuarios/me`, `PUT /contactos/{id}`, ver `routers.md`): el cliente debería poder mandar solo el campo que quiere cambiar (por ejemplo, `{"nombre": "Nuevo Nombre"}`) sin tener que reenviar todos los demás valores que no está tocando. Por eso cada campo es `str | None = None`: si no viene en el JSON de la petición, Pydantic lo completa con `None` en vez de rechazar la petición por "campo faltante".

El costo de este diseño es que el endpoint ya no puede confiar en que todos los campos del modelo tengan un valor útil — tiene que distinguir explícitamente "el cliente no mandó este campo" de "el cliente lo mandó vacío". Eso se resuelve en el router con `data.model_dump(exclude_none=True)`, que descarta del diccionario resultante cualquier campo que haya quedado en `None`, dejando solo los que el cliente realmente envió (ver `routers.md` para el detalle de cómo ese diccionario se convierte después en un `UPDATE ... SET` dinámico).

Una consecuencia de usar `None` como valor "no enviado" es que hoy no hay forma de, por ejemplo, borrar explícitamente el `correo` de un contacto mandando `null` a propósito (se interpretaría como "no lo toques", no como "vacíalo"). Es una limitación conocida y aceptable para el alcance actual del proyecto: los tres campos de `Contacto` casi nunca necesitan "vaciarse", solo reemplazarse por otro valor.

## Sobre `UsuarioLogin` y el campo `contraseña`

```python
class UsuarioLogin(BaseModel):
    correo:     str
    contraseña: str
```

`Usuario`, `UsuarioLogin` y `UsuarioUpdate` transportan la contraseña **en texto plano** desde el cliente hasta el backend; eso es necesario, ya que el backend es quien debe calcular o comparar el hash (no se le puede pedir al cliente que lo haga y confiar en el resultado). Lo importante es que este valor en texto plano nunca se persiste ni se reenvía:

- En `Usuario` y `UsuarioUpdate`, el router (`auth.py`, `usuarios.py`) lo pasa por `Guard.Crear` (ver `guard.md`) inmediatamente, y es el hash resultante el que llega a la base de datos.
- En `UsuarioLogin`, el router (`auth.py`) lo pasa por `Guard.Validar` junto con el hash ya guardado, y el resultado de esa comparación (verdadero o falso) es lo único que sigue circulando — la contraseña en sí se descarta apenas se usa.

`UsuarioLogin` no reutiliza `Usuario` aunque comparten dos campos (`correo`, `contraseña`) porque conceptualmente son peticiones distintas: una crea un recurso nuevo y necesita todos los datos de un usuario, la otra solo verifica una identidad ya existente. Forzar a que el cliente mande `nombre` y `telefono` para poder iniciar sesión hubiera sido confuso y no hubiera aportado nada al login.

## Relación con el resto del backend

Cada modelo se usa como tipo de parámetro en exactamente un endpoint de `modules/routers/` (ver `routers.md`):

| Modelo           | Endpoint             |
|-------------------|-----------------------|
| `Usuario`         | `POST /auth/registro` |
| `UsuarioLogin`     | `POST /auth/login`    |
| `UsuarioUpdate`    | `PUT /usuarios/me`    |
| `Contacto`         | `POST /contactos`     |
| `ContactoUpdate`   | `PUT /contactos/{id}` |
| `Alerta`           | `POST /alertas`       |

`GET /contactos/confirmar/{token}` (ver `routers.md`, `correo.md`) es la única excepción a "un endpoint, un modelo": no recibe cuerpo, el `token` viaja en la URL, así que no necesitó ningún modelo nuevo acá.

A medida que la API crezca (integración con una API de terceros como Twilio para notificar por SMS), se espera que este archivo siga acumulando un modelo por cada forma de dato que entra o sale de la API, siguiendo el mismo patrón.
