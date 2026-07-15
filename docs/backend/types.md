# `modules/types.py`

## Propósito

Este módulo define los modelos de datos (`pydantic.BaseModel`) que describen la forma que deben tener los datos que entran al backend a través de la API. Actualmente contiene un único modelo, `Usuario`.

```python
class Usuario(BaseModel):
    nombre:     str
    telefono:   str
    correo:     str
    contraseña: str
```

## Por qué Pydantic y no un `dict` simple

FastAPI usa las anotaciones de tipo de estas clases para tres cosas a la vez, sin código adicional:

1. **Validación automática**: si una petición a `POST /registrar/usuario` llega sin alguno de estos campos, o con un tipo incorrecto, FastAPI responde automáticamente con un `422 Unprocessable Entity` antes de que el código del endpoint (`main.py`) llegue a ejecutarse. Esto evita tener que escribir validaciones manuales (`if "nombre" not in data: ...`) en cada endpoint.
2. **Documentación automática**: FastAPI genera el esquema OpenAPI/Swagger (`/docs`) a partir de estas clases, así que el modelo sirve simultáneamente como contrato de la API y como documentación interactiva.
3. **Tipado en el resto del código**: dentro del endpoint, `data: Usuario` permite acceder a `data.nombre`, `data.telefono`, etc. con autocompletado y chequeo de tipos, en vez de indexar un diccionario sin garantías (`data["nombre"]`).

## Por qué todos los campos son obligatorios

Ninguno de los cuatro campos tiene un valor por defecto ni está envuelto en `Optional`, lo que en Pydantic significa que los cuatro son requeridos. Esto es consistente con el esquema de la tabla `usuarios` (ver `sql.md`), donde `nombre`, `telefono`, `correo` y `contraseña_hash` son todos `NOT NULL`: no tiene sentido que la API acepte un registro de usuario incompleto si la base de datos lo va a rechazar de todas formas, así que la validación se adelanta a la capa de entrada.

## Sobre el campo `contraseña`

El modelo transporta la contraseña **en texto plano** desde el cliente hasta el backend; eso es necesario, ya que el backend es quien debe calcular el hash (no se le puede pedir al cliente que lo haga y confiar en el resultado). Lo importante es que este valor en texto plano nunca se persiste ni se reenvía: `main.py` lo pasa por `Guard.Crear` (ver `guard.md`) inmediatamente, y es el hash resultante el que llega a la base de datos.

## Relación con el resto del backend

`main.py` usa `Usuario` como tipo del parámetro `data` en el endpoint `registrar_usuario`. A medida que la API crezca (login, gestión de contactos de emergencia, registro de alertas), se espera que este archivo acumule un modelo por cada forma de dato que entra o sale de la API, siguiendo el mismo patrón.
