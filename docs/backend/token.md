# `modules/token.py`

## Propósito

```python
from datetime import datetime, timedelta, timezone

import jwt

from modules.credenciales import obtener_credenciales

ALGORITMO: str = "HS256"
EXPIRACION: timedelta = timedelta(hours=24)

_secreto: str = obtener_credenciales()['jwt']['secret_key']

class Token:
    @staticmethod
    def Crear(id_usuario: int) -> str:
        payload: dict = {
            "sub": str(id_usuario),
            "exp": datetime.now(timezone.utc) + EXPIRACION,
        }
        return jwt.encode(payload, _secreto, algorithm=ALGORITMO)

    @staticmethod
    def Validar(token: str) -> dict | None:
        try:
            return jwt.decode(token, _secreto, algorithms=[ALGORITMO])
        except jwt.InvalidTokenError:
            return None
```

Este módulo aísla todo lo relacionado con emitir y verificar JSON Web Tokens (JWT) detrás de una clase `Token` con dos métodos estáticos, siguiendo exactamente el mismo patrón que `Guard` (ver `guard.md`) usa para contraseñas:

- `Token.Crear(id_usuario)`: genera un token firmado que representa "esta petición viene de este usuario, y es válido hasta tal fecha".
- `Token.Validar(token)`: dado un token que llegó en una petición, verifica que esté bien firmado y no haya expirado, y devuelve el contenido que llevaba adentro (o `None` si algo no cuadra).

## Qué es un JWT y por qué resuelve el problema del login

HTTP no tiene memoria: cada request es independiente y el servidor, por defecto, no sabe si dos peticiones vienen del mismo usuario que ya inició sesión. `POST /auth/login` (ver `routers.md`) verifica una vez la contraseña, pero ese resultado tiene que viajar de alguna forma en cada petición siguiente para que endpoints como `GET /usuarios/me` sepan de quién son.

Un JWT es la solución elegida para eso: es una cadena de texto con tres partes (cabecera, contenido o "payload", y firma) que el servidor genera una sola vez, en el login, y el cliente reenvía en cada petición posterior dentro del header `Authorization: Bearer <token>` (ver `dependencies.md` para cómo se lee ese header). El contenido de este proyecto es deliberadamente mínimo:

```python
payload: dict = {
    "sub": str(id_usuario),
    "exp": datetime.now(timezone.utc) + EXPIRACION,
}
```

- **`sub`** ("subject", un nombre de claim estándar de JWT) es el `id` del usuario dueño del token, convertido a texto porque la especificación de JWT espera que los claims sean tipos simples serializables a JSON, y el estándar recomienda que `sub` sea una cadena.
- **`exp`** ("expiration", también estándar) es la fecha a partir de la cual el token deja de ser válido. `jwt.decode` la revisa automáticamente y lanza una excepción si ya pasó — no hay que comparar fechas a mano en este módulo.

## Por qué "sin estado" (nadie consulta la base de datos para validar un token)

Lo importante de un JWT firmado es que su contenido **no se puede alterar sin invalidar la firma**: si alguien intercepta un token y le cambia el `sub` para hacerse pasar por otro usuario, `jwt.decode` detecta que la firma ya no coincide con el contenido y lo rechaza. Esa propiedad es justamente lo que permite que `Token.Validar` no necesite preguntarle nada a la base de datos ni a ninguna tabla de "sesiones activas": si la firma es válida y no expiró, se confía en que el `sub` es quien dice ser, sin una consulta SQL de por medio. Esto es deliberadamente más simple que otras alternativas (por ejemplo, guardar sesiones en una tabla y revisar esa tabla en cada request) y es consistente con el resto del proyecto, que evita infraestructura adicional mientras no haga falta (ver también `main.md`, sección de arquitectura).

La contrapartida de este diseño es que un token no se puede "invalidar" antes de que expire — no existe un `DELETE /sesiones/{token}` posible, porque no hay ningún lado donde el servidor lo esté recordando. Por eso `EXPIRACION` está fijada a 24 horas: es un balance entre no obligar al usuario a loguearse todo el tiempo y no dejar un token robado utilizable indefinidamente. Si el proyecto necesitara poder revocar sesiones activas (por ejemplo, un "cerrar sesión en todos los dispositivos"), haría falta introducir estado en el servidor, algo que hoy no está implementado a propósito.

## Por qué `pyjwt` y no otra librería

Existen varias librerías de Python para JWT; se eligió `pyjwt` porque el algoritmo usado acá (`HS256`, HMAC con SHA-256) es simétrico — la misma clave (`JWT_SECRET_KEY`, ver `credenciales.md`) sirve tanto para firmar como para verificar — y `pyjwt` cubre ese caso sin dependencias adicionales de criptografía asimétrica que este proyecto no necesita (alternativas como `python-jose` traen soporte para más algoritmos y formatos, a costa de más peso y superficie).

## Por qué el secreto se lee una sola vez, a nivel de módulo

```python
_secreto: str = obtener_credenciales()['jwt']['secret_key']
```

Esta línea corre una única vez, la primera vez que algo importa `modules.token` (el mismo mecanismo de módulos-como-singleton que se explica en `db.md`). Evita volver a leer el `.env` en cada llamada a `Crear` o `Validar` — el secreto no cambia mientras el proceso está corriendo, así que no hay motivo para releerlo. El guion bajo al inicio (`_secreto`) es una convención de Python para señalar "esto es un detalle interno del módulo, no lo importes desde otro lado" — quien necesite crear o validar tokens debe hacerlo a través de `Token`, no leyendo `_secreto` directamente.

## Por qué `Validar` devuelve `None` en vez de dejar propagar la excepción

`jwt.decode` lanza distintas subclases de `jwt.InvalidTokenError` según qué salió mal (firma inválida, token expirado, formato corrupto, etc.). A quien llama a `Token.Validar` — hoy, únicamente `modules/dependencies.py` (ver `dependencies.md`) — no le importa *cuál* de esos problemas ocurrió, solo si el token es utilizable o no. Por eso el método captura la clase base `jwt.InvalidTokenError` (que cubre todos los casos anteriores) y devuelve `None` de forma uniforme, dejando que sea la capa de arriba la que decida qué código HTTP corresponde (en este caso, `401 Unauthorized`).

## Relación con el resto del backend

`auth.py` llama a `Token.Crear(id_usuario)` al final de un login exitoso, dentro de `POST /auth/login` (ver `routers.md`). `modules/dependencies.py` llama a `Token.Validar(token)` en la dependencia `usuario_actual`, que protege todos los endpoints que requieren estar autenticado (`GET`/`PUT /usuarios/me`, `POST`/`GET`/`PUT /contactos`).

## `CrearConfirmacionContacto` y `ValidarConfirmacionContacto`

```python
EXPIRACION_CONFIRMACION_CONTACTO: timedelta = timedelta(days=7)

@staticmethod
def CrearConfirmacionContacto(id_contacto: int) -> str:
    payload: dict = {
        "contacto_id": id_contacto,
        "tipo": "confirmacion_contacto",
        "exp": datetime.now(timezone.utc) + EXPIRACION_CONFIRMACION_CONTACTO,
    }
    return jwt.encode(payload, _secreto, algorithm=ALGORITMO)

@staticmethod
def ValidarConfirmacionContacto(token: str) -> int | None:
    payload: dict | None = Token.Validar(token)
    if payload is None or payload.get("tipo") != "confirmacion_contacto":
        return None
    return int(payload["contacto_id"])
```

Se agregaron para el flujo de confirmación de contactos de emergencia (ver `correo.md` para el flujo completo). Es un segundo tipo de JWT, con su propio propósito, que convive con el token de sesión sin reemplazarlo ni reutilizar sus métodos sin cambios:

- **No es el mismo payload que un token de sesión a propósito**: un token de sesión lleva `{"sub": id_usuario, "exp": ...}`; un token de confirmación lleva `{"contacto_id": ..., "tipo": "confirmacion_contacto", "exp": ...}`. El claim `"tipo"` es la pieza que evita que ambos tipos de token sean intercambiables entre sí — sin él, un token de sesión y uno de confirmación firmados con el mismo secreto serían indistinguibles en su forma, y uno podría colarse por el endpoint pensado para el otro si los valores numéricos (`id_usuario` vs `id_contacto`) coincidieran. `ValidarConfirmacionContacto` rechaza (devuelve `None`) cualquier token que no tenga exactamente `"tipo": "confirmacion_contacto"`, aunque esté firmado correctamente y no haya expirado.
- **Reutiliza `Token.Validar` para el decode**, no reimplementa la verificación de firma/expiración: `ValidarConfirmacionContacto` llama primero a `Validar` (que ya sabe capturar `jwt.InvalidTokenError` y devolver `None` de forma uniforme, ver más arriba) y solo agrega, encima de eso, la comprobación del claim `"tipo"`. Esto evita duplicar la lógica de `jwt.decode` en dos lugares del mismo archivo.
- **Expiración deliberadamente más larga** (`7 días` contra las `24 horas` del token de sesión): un contacto de emergencia puede tardar en revisar su correo, y no hay urgencia de seguridad equivalente a la de una sesión activa que justifique una ventana corta.

`modules/routers/contactos.py` es el único lugar que usa este segundo par de métodos: `POST /contactos` llama a `CrearConfirmacionContacto` para generar el link que se manda por correo (ver `correo.md`), y `GET /contactos/confirmar/{token}` llama a `ValidarConfirmacionContacto` para decidir si puede marcar `confirmado = TRUE` (ver `routers.md`).
