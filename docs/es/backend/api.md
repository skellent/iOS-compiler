# Referencia de la API

Referencia rápida de cada ruta. 🔒 = requiere `Authorization: Bearer <token>` (ver [auth.md](auth.md)). Los cuerpos completos de petición/respuesta y ejemplos de código viven en [`backend/API.md`](../../../backend/API.md).

## `/auth`

| Método y ruta | Auth | Propósito |
|---|---|---|
| `POST /auth/register` | — | Crea un usuario, envía por correo un enlace de confirmación de cuenta. Con límite de tasa; se verifica la entregabilidad del dominio. |
| `POST /auth/login` | — | Verifica credenciales + `confirmed`, devuelve un JWT. Con límite de tasa. |
| `GET /auth/confirm/{token}` | — | Confirma una cuenta desde el enlace del correo (página HTML). |

## `/users`

| Método y ruta | Auth | Propósito |
|---|---|---|
| `GET /users/me` | 🔒 | Perfil del usuario actual. |
| `PUT /users/me` | 🔒 | Actualización parcial (nombre/teléfono/email/contraseña) — cambiar email o contraseña requiere además `current_password` (ver [auth.md](auth.md)). |

## `/contacts`

| Método y ruta | Auth | Propósito |
|---|---|---|
| `POST /contacts` | 🔒 | Agrega un contacto de emergencia (máx. 4), envía confirmación si tiene email. |
| `GET /contacts` | 🔒 | Lista contactos con `confirmed`, `telegram_linked`, `whatsapp_enabled`, `whatsapp_confirmed`, `sms_enabled`. |
| `GET /contacts/confirm/{token}` | — | Confirma el email de un contacto desde el enlace (página HTML). |
| `PUT /contacts/{id}` | 🔒 | Actualización parcial — cambiar el email reinicia la confirmación y la reenvía. |
| `POST /contacts/{id}/confirm/resend` | 🔒 | Reenvía la confirmación por correo a un contacto no confirmado. Con límite de tasa. |
| `DELETE /contacts/{id}` | 🔒 | Elimina un contacto. Las alertas pasadas conservan su nombre (ver [database.md](database.md)). |
| `POST /contacts/{id}/telegram/enable` | 🔒 | Inicia una vinculación de Telegram (devuelve un enlace `t.me` o lo envía por correo). |
| `DELETE /contacts/{id}/telegram` | 🔒 | Desvincula Telegram. |
| `POST /contacts/{id}/whatsapp/enable` | 🔒 | Activa WhatsApp; devuelve un enlace `wa.me` de opt-in. |
| `DELETE /contacts/{id}/whatsapp` | 🔒 | Desactiva WhatsApp (limpia enabled + confirmed). |
| `POST /contacts/{id}/sms/enable` | 🔒 | Activa SMS para el contacto. |
| `DELETE /contacts/{id}/sms` | 🔒 | Desactiva SMS. |

## `/alerts`

| Método y ruta | Auth | Propósito |
|---|---|---|
| `POST /alerts` | 🔒 | Dispara una alerta de pánico; notifica a cada contacto confirmado por cada canal activo. Con límite de tasa. Devuelve conteos por canal. |
| `GET /alerts` | 🔒 | Lista alertas, cada una con sus notificaciones (`contact_name`, `channel`, `viewed_at`, `contact_removed`). |
| `GET /alerts/view/{token}` | — | Enlace del mapa enviado a un contacto — lo marca como visto y redirige a Google Maps. |

Respuesta de `POST /alerts`:

```json
{
  "id": 42,
  "created_at": "2026-08-20T15:28:33",
  "notified_contacts": 3,
  "channels": { "email": 2, "telegram": 1, "whatsapp": 1, "sms": 0 }
}
```

## Webhooks

| Método y ruta | Auth | Propósito |
|---|---|---|
| `POST /telegram/webhook` | secreto de webhook | Telegram llama a esto en cada update del bot. |
| `POST /whatsapp/webhook` | firma de Twilio | Twilio llama a esto en mensajes de WhatsApp de entrada (opt-in). |

## `/features` y rutas de servicio

| Método y ruta | Auth | Propósito |
|---|---|---|
| `GET /features` | — | `{"telegram": bool, "whatsapp": bool, "sms": bool, "max_contacts": int}`. |
| `GET /health` | — | Servicio + alcanzabilidad de la base (`200` / `503`). |
| `GET /favicon.ico` | — | Favicon del sitio. |
| `GET /` | — | Landing. |
| `GET /dashboard` | — | Panel de alertas (inicia sesión con una cuenta de la app). |

El registro, login, reenvío y alerta tienen límite de tasa; superarlo devuelve `429`. Ver [operations.md](operations.md). Los estáticos se sirven en `/static`, y la UI móvil en `/app` (ver [web-pages.md](web-pages.md) y [app/architecture.md](../app/architecture.md)).
