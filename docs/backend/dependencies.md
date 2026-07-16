# `modules/dependencies.py`

## Propósito

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from modules.token import Token

_seguridad = HTTPBearer()


def usuario_actual(credenciales: HTTPAuthorizationCredentials = Depends(_seguridad)) -> int:
    payload: dict | None = Token.Validar(credenciales.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    return int(payload["sub"])
```

Este módulo define `usuario_actual`, una **dependencia de FastAPI**: una función que cualquier endpoint puede pedir como parámetro para exigir que la petición venga acompañada de un JWT válido (ver `token.md`), y para obtener de forma directa el `id` del usuario autenticado, sin tener que repetir la lógica de "leer el header, validar el token, sacar el `id`" en cada endpoint protegido.

## Qué es `Depends` y por qué no se llama a `usuario_actual()` directamente

`Depends(usuario_actual)` no es una llamada normal a una función. Es una instrucción para FastAPI: "antes de ejecutar este endpoint, ejecutá vos `usuario_actual`, resolvé lo que necesite (en este caso, el propio header `Authorization`), y pasame el resultado como argumento". Esto es lo que permite que un endpoint como `GET /usuarios/me` (ver `routers.md`) se declare así:

```python
@router.get("/me")
def obtener_usuario_actual(id_usuario: int = Depends(usuario_actual)):
    ...
```

y reciba directamente un `int` con el `id` del usuario, sin ninguna línea propia dedicada a leer tokens: si el token falta o es inválido, la función del endpoint ni siquiera llega a ejecutarse — FastAPI corta el flujo en la dependencia y responde el error antes. Es el mismo mecanismo, en espíritu, que la validación automática de Pydantic (ver `types.md`): mover una responsabilidad transversal (autenticación) fuera del cuerpo de cada endpoint y hacia la firma de la función, donde es imposible olvidarla por accidente.

## Qué es `HTTPBearer` y de dónde sale `credenciales.credentials`

```python
_seguridad = HTTPBearer()
```

`HTTPBearer` es una clase de FastAPI que sabe leer el header HTTP estándar `Authorization: Bearer <token>`. Cuando se usa como dependencia (`Depends(_seguridad)`), FastAPI se encarga de:

1. Buscar el header `Authorization` en la petición.
2. Verificar que tenga el formato `Bearer <algo>` (si falta el header, o no tiene ese formato, FastAPI responde `401 Unauthorized` con el mensaje `"Not authenticated"` automáticamente, sin que este código tenga que hacer nada).
3. Envolver el resultado en un objeto `HTTPAuthorizationCredentials`, cuyo atributo `.credentials` es el token en sí (la parte después de `Bearer `).

`usuario_actual` no valida el *formato* del header — eso ya lo hizo `HTTPBearer` antes de que la función se ejecute. Lo único que le queda por hacer es tomar `credenciales.credentials` (el token crudo) y pasárselo a `Token.Validar` (ver `token.md`) para confirmar que, además de tener el formato correcto, es un token genuino y vigente.

El guion bajo en `_seguridad` sigue la misma convención que `_secreto` en `token.md`: es un detalle interno de este módulo, nadie fuera de acá debería necesitar el objeto `HTTPBearer` en sí, solo la dependencia `usuario_actual` que lo usa por dentro.

## Por qué esto vive en un módulo aparte y no dentro de cada router

`usuario_actual` la usan los tres endpoints de `usuarios.py` y los tres de `contactos.py` (ver `routers.md`) — es, después de `cursor` (ver `db.md`), la segunda pieza más compartida entre routers. Ponerla en su propio módulo evita que cada archivo de `modules/routers/` tenga que redefinir su propia versión de "leer y validar el token", y hace explícito que la autenticación es una preocupación transversal, no algo propio de un único recurso.

## Diagrama: de la petición HTTP al `id_usuario`

```mermaid
sequenceDiagram
    participant Cliente
    participant FastAPI
    participant HTTPBearer
    participant usuario_actual as usuario_actual()
    participant Token as Token.Validar
    participant Endpoint as endpoint protegido

    Cliente->>FastAPI: GET /usuarios/me<br/>Authorization: Bearer &lt;token&gt;
    FastAPI->>HTTPBearer: leer header Authorization
    alt header ausente o mal formado
        HTTPBearer-->>Cliente: 401 Not authenticated
    else header presente
        HTTPBearer->>usuario_actual: HTTPAuthorizationCredentials
        usuario_actual->>Token: Validar(credenciales.credentials)
        alt token inválido o expirado
            Token-->>usuario_actual: None
            usuario_actual-->>Cliente: 401 Token inválido o expirado
        else token válido
            Token-->>usuario_actual: payload (incluye sub)
            usuario_actual->>Endpoint: id_usuario (int)
            Endpoint-->>Cliente: 200 + datos
        end
    end
```

## Relación con el resto del backend

`modules/routers/usuarios.py` y `modules/routers/contactos.py` (ver `routers.md`) importan `usuario_actual` y lo usan como `Depends(usuario_actual)` en cada endpoint que debe pertenecer a un usuario autenticado. `modules/routers/auth.py` es la única excepción deliberada: ni `POST /auth/registro` ni `POST /auth/login` pueden exigir un token, porque su propósito es, justamente, conseguir uno.
