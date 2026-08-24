# Operaciones

Todo lo que un operador necesita: variables de entorno, logging, límites de tasa, feature flags, health checks, migraciones y el script de mantenimiento.

## Variables de entorno

`get_credentials()` (en `modules/credentials.py`) carga `.env` con `python-dotenv` (`override=True`) y devuelve un dict agrupado. Los valores requeridos que falten lanzan un `MissingCredentialError` claro al arrancar.

| Grupo | Variables | Notas |
|---|---|---|
| **Base de datos** | `USERNAME`, `PASSWORD`, `HOST`, `PORT`, `DATABASE` | Requeridas. Ver [database.md](database.md). |
| **JWT** | `JWT_SECRET_KEY` | Requerida. Firma cada token; usa 32+ bytes aleatorios. |
| **Email (SMTP)** | `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_HOST` (default `smtp.gmail.com`), `SMTP_PORT` (default `587`), `SMTP_FROM` (default `SMTP_USER`), `SMTP_ENABLED` (default `true`), `SMTP_VERIFY_DELIVERABILITY` (default `true`) | Todas opcionales. Ver [notifications.md](notifications.md). |
| **Telegram** | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | Opcionales. Las tres para que el canal esté activo. |
| **Twilio (compartidas)** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Compartidas por WhatsApp y SMS. |
| **WhatsApp** | `TWILIO_WHATSAPP_FROM`, `TWILIO_WHATSAPP_JOIN_KEYWORD`, `TWILIO_WHATSAPP_TEMPLATE_SID`, `TWILIO_WHATSAPP_ENABLED` (default `true`), `TWILIO_VALIDATE_SIGNATURE` (default `true`) | Ver [twilio.md](twilio.md). |
| **SMS** | `TWILIO_SMS_FROM`, `TWILIO_SMS_ENABLED` (default `true`) | Ver [twilio.md](twilio.md). |
| **General** | `API_BASE_URL` (default `http://127.0.0.1:8000`), `APP_MODE` (default `Debug`), `LOG_LEVEL` (default `INFO`) | `API_BASE_URL` debe ser la URL pública HTTPS en producción. |

**Interruptores dry-run.** `SMTP_ENABLED`, `TWILIO_WHATSAPP_ENABLED` y `TWILIO_SMS_ENABLED` en `false` registran lo que *habrían* enviado en vez de enviarlo — para desarrollo local con cuentas reales. `SMTP_VERIFY_DELIVERABILITY=false` salta el chequeo DNS del dominio (para trabajar sin conexión). Producción los deja en `true`.

**Secretos.** `JWT_SECRET_KEY` y `TELEGRAM_WEBHOOK_SECRET` son valores que este despliegue inventa. Genera uno distinto por entorno y nunca commitees `.env`:

```bash
uv run python -c "import secrets; print(secrets.token_hex(32))"
```

`SMTP_PASSWORD` para Gmail/Workspace es una **contraseña de aplicación** de 16 caracteres, no la del acceso.

## Activar / desactivar un canal

Un canal se ofrece a la app solo cuando sus credenciales están presentes. `GET /features` lo reporta, y la app oculta la UI del canal cuando está apagado:

| Canal | Activo cuando están todas | Apagar vaciando |
|---|---|---|
| Telegram | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` | `TELEGRAM_BOT_TOKEN` |
| WhatsApp | `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_WHATSAPP_FROM` | `TWILIO_WHATSAPP_FROM` |
| SMS | `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_SMS_FROM` | `TWILIO_SMS_FROM` |

WhatsApp y SMS **comparten** `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`, así que vacía el `*_FROM` propio de cada canal para apagar solo ese. Los cambios requieren reiniciar (las credenciales se leen una vez al arrancar).

## Límites de tasa (rate limiting)

`POST /auth/register`, `POST /auth/login` y `POST /alerts` tienen límite con `slowapi`; superarlo devuelve `429`. Login/register se limitan por dirección de cliente, las alertas por id de usuario. Detrás de un proxy, la IP real solo llega al limitador si el proxy la reenvía (`X-Forwarded-For`) y Uvicorn corre con `--proxy-headers`.

## Health check — `GET /health`

Devuelve `{"status":"ok","database":true}` (`200`) cuando la base es alcanzable, `503` si no — para un supervisor o monitor de uptime. El mismo chequeo corre al arrancar y el proceso se niega a bootear si falla.

## Logging

`logging` estándar: stdout más un archivo rotativo (`backend/logs/panicbutton.log`, 5 MB × 3, gitignored). `LOG_LEVEL` fija la severidad mínima. Cada línea lleva un **request id** corto (asignado por petición, heredado por las tareas en segundo plano) para seguir una alerta y su reparto de punta a punta. El logger de `httpx` está fijado a `WARNING` para que los tokens de bot nunca aparezcan en el log.

Líneas útiles para grep:

- `Telegram webhook status: url=… last_error=…` — al arrancar, indica si el webhook de Telegram está registrado (ver [notifications.md](notifications.md)).
- `WhatsApp webhook: received inbound from …` / `opt-in confirmed for contacts …` — opt-in de WhatsApp.
- `Twilio rejected SMS … [status=…]` — un SMS que Twilio rechazó (a menudo geo-permisos o número sin verificar).
- `Alert N: notifying X by email, Y by Telegram, Z by WhatsApp, W by SMS` — conteos de reparto por alerta.

## Feature flags — `GET /features`

```json
{"telegram": true, "whatsapp": true, "sms": true, "max_contacts": 4}
```

Sin autenticación, cacheado por la app durante su sesión. `max_contacts` es el tope de contactos de emergencia, servido para que app y backend no se desincronicen.

## Migraciones

`queries/tables.sql` es el esquema completo para instalaciones nuevas. Para actualizar una base existente, aplica los archivos de `queries/migrations/` **en orden de fecha, una vez cada uno** (no son idempotentes):

```bash
mariadb -u <user> -p <DATABASE> < queries/migrations/2026-08-add-whatsapp.sql
mariadb -u <user> -p <DATABASE> < queries/migrations/2026-08-add-sms.sql
mariadb -u <user> -p <DATABASE> < queries/migrations/2026-08-dashboard-history.sql
```

- **add-whatsapp** — columnas de WhatsApp + `whatsapp` en el enum `channel`.
- **add-sms** — columna SMS + `sms` en el enum `channel`.
- **dashboard-history** — `alert_notifications.contact_name` + `contact_id` pasa a `ON DELETE SET NULL` (borrar un contacto ya no vacía el historial de la alerta). Rellena los nombres existentes.

Confirma que una migración se aplicó, p. ej.: `SHOW COLUMNS FROM alert_notifications LIKE 'contact_name';`.

## Script de mantenimiento

```bash
uv run scripts/purge_unconfirmed_users.py
```

Borra cuentas aún sin confirmar 24 h después del registro. Seguro por diseño (el login está bloqueado antes de confirmar, así que esas cuentas no poseen nada). Córrelo periódicamente con cron; no está cableado a la API.
