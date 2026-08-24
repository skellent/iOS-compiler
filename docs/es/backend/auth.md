# Autenticación

Dos piezas independientes: `Guard` (hash de contraseñas) y `Token` (JWT). Ninguna toca la base de datos — los routers las combinan con llamadas a `Cursor`.

## Hash de contraseñas — `guard.py`

```python
class Guard:
    Hash(password) -> str      # guardar esto, nunca el texto plano
    Verify(password, stored_hash) -> bool
```

El `CryptContext` de `passlib` con **bcrypt** maneja el salting. `deprecated="auto"` significa que si la lista de esquemas alguna vez crece, los hashes viejos siguen verificando mientras los nuevos usan el esquema más reciente.

## JWT — `token.py`

Un secreto (`JWT_SECRET_KEY`), algoritmo `HS256`, y cuatro *propósitos* de token distinguidos por un claim `type` — así un enlace de confirmación nunca puede reproducirse como una sesión de login, aunque ambos sean "solo un JWT válido":

| Propósito | Creado por | Payload | Expira |
|---|---|---|---|
| Sesión de login | `Token.Create` | `sub` (id de usuario), `type=session` | 30 días |
| Confirmación de cuenta | `Token.CreateUserConfirmation` | `user_id`, `type=user_confirmation` | 24 h |
| Confirmación de contacto | `Token.CreateContactConfirmation` | `contact_id`, `type=contact_confirmation` | 7 días |
| Enlace de vista de alerta | `Token.CreateAlertNotificationView` | `notification_id`, `type=alert_notification_view` | 30 días |

`Token.Validate` solo verifica firma/expiración y devuelve el payload crudo o `None`. Cada wrapper `Validate<Propósito>` además verifica que `payload["type"]` coincida antes de confiar en el id que contiene — "cualquier firma válida" no basta.

El enlace de vista de alerta vive más que los de confirmación (30 días) porque un contacto puede reabrir el mapa bastante después de una alerta, pero igual expira para que un mensaje viejo no revele una ubicación para siempre.

## `current_user`

```python
def current_user(credentials = Depends(_security)) -> int:
    user_id = Token.ValidateSession(credentials.credentials)
    if user_id is None:
        raise HTTPException(401, "Invalid or expired token")
    return user_id
```

El `HTTPBearer` de FastAPI extrae `Authorization: Bearer <token>`; cada ruta protegida declara `user_id: int = Depends(current_user)`. `ValidateSession` exige el claim `type=session`, así que solo un token de login real abre una ruta protegida — cualquier otro JWT válido se rechaza con `401`.

## Login

```mermaid
sequenceDiagram
    participant App
    participant Auth as POST /auth/login
    participant Guard
    participant DB

    App->>Auth: email + password
    Auth->>DB: SELECT ... WHERE email = ?
    Auth->>Guard: Verify(password, hash)
    alt contraseña incorrecta / no existe
        Auth-->>App: 401
    else no confirmado
        Auth-->>App: 403
    else ok
        Auth-->>App: access_token
    end
```

La app guarda `access_token` (`@capacitor/preferences`) y lo envía como `Authorization: Bearer <token>` en cada llamada autenticada.

## Reautenticación para cambios sensibles

Cambiar el email o la contraseña de la cuenta (`PUT /users/me`) requiere la **contraseña actual** en el cuerpo (`current_password`), aun con un token de sesión válido. Un token de 30 días es cómodo pero de larga vida; volver a pedir la contraseña significa que un token robado por sí solo no basta para apropiarse de la cuenta. El chequeo verifica `current_password` contra el hash almacenado (falta → `400`, incorrecta → `403`); editar solo nombre o teléfono no la pide. Cuando cambia un campo sensible, se envía un aviso de seguridad a la dirección que figuraba **antes** del cambio, para que el dueño legítimo se entere aunque el propio email se haya cambiado (ver [notifications.md](notifications.md)).

## Restablecer contraseña (olvidé mi contraseña)

Para un usuario que no puede iniciar sesión, un quinto propósito de token maneja un enlace de restablecimiento por correo:

| Propósito | Creado por | Payload | Expira |
|---|---|---|---|
| Restablecer contraseña | `Token.CreatePasswordReset` | `user_id`, `type=password_reset` | 1 hora |

```mermaid
sequenceDiagram
    participant App
    participant API
    participant Mail
    participant Page as Página web de reset
    App->>API: POST /auth/password-reset/request {email}
    API-->>App: 200 (siempre la misma respuesta)
    API->>Mail: enlace de reset (si la cuenta existe)
    Mail-->>Page: el usuario abre GET /auth/password-reset/{token}
    Page->>API: POST /auth/password-reset/{token} {password}
    API->>API: actualiza password_hash, envía aviso de seguridad
```

- **La solicitud** (`POST /auth/password-reset/request`) tiene límite de tasa y **siempre devuelve la misma respuesta** exista o no el email — sin enumeración de cuentas. Si existe, se envía un enlace válido por 1 hora.
- **El enlace** (`GET /auth/password-reset/{token}`) sirve una pequeña página web con un formulario de nueva contraseña; un token inválido/expirado muestra la página de error estándar.
- **El formulario** envía la nueva contraseña a `POST /auth/password-reset/{token}`, que valida el token (**con chequeo de tipo**, así un token de sesión o de confirmación no sirve aquí), actualiza el hash y envía un aviso de seguridad.
- En la app, un enlace **"¿Olvidaste tu contraseña?"** en el login dispara la solicitud.

