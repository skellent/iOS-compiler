# Referencia de la API

Referencia rápida de cada ruta. Los cuerpos completos de petición/respuesta y ejemplos de uso en Python/JavaScript viven en [`backend/API.md`](../../../backend/API.md) — esta página es el mapa, esa es el detalle. 🔒 = requiere `Authorization: Bearer <token>` (ver [`auth.md`](auth.md)).

## `/auth`

| Método y ruta | Auth | Propósito |
|---|---|---|
| `POST /auth/register` | — | Crea un usuario, envía por correo un enlace de confirmación de cuenta |
| `POST /auth/login` | — | Verifica credenciales + `confirmed`, devuelve un JWT |
| `GET /auth/confirm/{token}` | — | Confirma una cuenta desde el enlace del correo (página HTML) |

## `/users`

| Método y ruta | Auth | Propósito |
|---|---|---|
| `GET /users/me` | 🔒 | Perfil del usuario actual |
| `PUT /users/me` | 🔒 | Actualización parcial (nombre/teléfono/email/contraseña) |

## `/contacts`

| Método y ruta | Auth | Propósito |
|---|---|---|
| `POST /contacts` | 🔒 | Agrega un contacto de emergencia (máx. 4), envía un enlace de confirmación si tiene email |
| `GET /contacts` | 🔒 | Lista los contactos del usuario actual, con flags `confirmed`/`telegram_linked` |
| `GET /contacts/confirm/{token}` | — | Confirma un contacto desde el enlace del correo (página HTML) |
| `PUT /contacts/{id}` | 🔒 | Actualización parcial |
| `DELETE /contacts/{id}` | 🔒 | Elimina un contacto |
| `POST /contacts/{id}/telegram/enable` | 🔒 | Inicia una vinculación de Telegram (ver [`notifications.md`](notifications.md)) |
| `DELETE /contacts/{id}/telegram` | 🔒 | Desvincula Telegram de un contacto |

## `/alerts`

| Método y ruta | Auth | Propósito |
|---|---|---|
| `POST /alerts` | 🔒 | Dispara una alerta de pánico — notifica a cada contacto confirmado por email y/o Telegram |
| `GET /alerts` | 🔒 | Lista las alertas del usuario actual, cada una con estado de entrega por contacto/canal |
| `GET /alerts/view/{token}` | — | Enlace al mapa enviado a un contacto por correo/Telegram — lo marca como visto y redirige a Google Maps |

## `/telegram`

| Método y ruta | Auth | Propósito |
|---|---|---|
| `POST /telegram/webhook` | secreto de webhook | Telegram llama a esto en cada update del bot; no está pensado para llamarse directamente |

## `/features`

| Método y ruta | Auth | Propósito |
|---|---|---|
| `GET /features` | — | `{"telegram": bool}` — si este despliegue tiene un bot de Telegram configurado |

## Páginas web (no JSON)

Ver [`web-pages.md`](web-pages.md) para `GET /`, `GET /dashboard`, y los mounts estáticos `/app`/`/static`.
