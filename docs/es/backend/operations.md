# Operaciones

Variables de entorno, logging, feature flags, y el único script de mantenimiento — todo lo que necesita un operador (no alguien leyendo el código) para correr esto.

## Variables de entorno (`credentials.py`)

`get_credentials()` lee `.env` (`python-dotenv`, `override=True` — ver nota abajo) y devuelve un solo dict, agrupado por tema:

| Grupo | Variables | Notas |
|---|---|---|
| Base de datos | `USERNAME`, `PASSWORD`, `HOST`, `PORT`, `DATABASE` | Ver [`database.md`](database.md) |
| JWT | `JWT_SECRET_KEY` | Firma/verifica tokens de sesión + confirmación, ver [`auth.md`](auth.md) |
| SMTP | `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_HOST` (default `smtp.gmail.com`), `SMTP_PORT` (default `587`), `SMTP_FROM` (por defecto igual a `SMTP_USER`), `SMTP_ENABLED` (default `true`), `SMTP_VERIFY_DELIVERABILITY` (default `true`) | Ver [`notifications.md`](notifications.md) |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | Todas opcionales — sin definir simplemente significa que la función está apagada |
| General | `API_BASE_URL` (default `http://127.0.0.1:8000`), `APP_MODE` (default `Debug`), `LOG_LEVEL` (default `INFO`) | |

`override=True` importa específicamente en Windows: el sistema operativo predefine su propia variable de entorno `USERNAME` (la cuenta de Windows con la que se inició sesión), y `load_dotenv()` deja intactas las variables de entorno existentes por defecto — sin `override=True`, el propio `USERNAME` del `.env` (el usuario de MariaDB) pierde en silencio contra la cuenta de Windows que esté corriendo el proceso.

`SMTP_PASSWORD` es una **contraseña de aplicación** de Google Workspace de 16 caracteres, no la contraseña real de la cuenta (Gmail no acepta autenticación SMTP básica en cuentas Workspace desde marzo de 2025) — se genera en `myaccount.google.com/apppasswords` con verificación en 2 pasos activa. `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME` vienen del `@BotFather` de Telegram (`/newbot`); `TELEGRAM_WEBHOOK_SECRET`, igual que `JWT_SECRET_KEY`, es un string aleatorio que este despliegue inventa:

```bash
uv run python -c "import secrets; print(secrets.token_hex(32))"
```

Generar un valor separado por entorno (dev, prod) para ambos secretos — nunca reutilizar uno entre ellos, nunca commitear `.env` (ya está en `.gitignore`).

`SMTP_ENABLED=false` registra el correo saliente en el log en vez de enviarlo, y `SMTP_VERIFY_DELIVERABILITY=false` salta la comprobación del dominio del destinatario (ver [`notifications.md`](notifications.md)) — ambos pensados para desarrollo local (el segundo para trabajar sin conexión, donde no se pueden hacer consultas DNS). Producción deja ambos en su valor por defecto `true`, y el proceso necesita DNS saliente para que la comprobación de entregabilidad funcione.

## Límite de tasa

`POST /auth/register`, `POST /auth/login` y `POST /alerts` tienen límite de tasa (`slowapi`); superado el límite, la petición recibe un `429` antes de que corra su handler. Login y register se agrupan por dirección de cliente — así el registro no se puede automatizar como un emisor de correo sin autenticar, y las contraseñas no se pueden adivinar sin freno — mientras que `POST /alerts` se agrupa por id de usuario, así una cuenta en una red compartida no consume el cupo de las demás. Detrás de un proxy inverso, la dirección real del cliente solo llega al limitador si el proxy la reenvía (`X-Forwarded-For`) y Uvicorn se ejecuta con `--proxy-headers`; de lo contrario toda petición parece venir del proxy y comparte un solo cupo.

## Chequeo de salud — `GET /health`

Devuelve `{"status": "ok", "database": true}` con un `200` cuando la base de datos es alcanzable, o un `503` cuando no lo es — un único endpoint que un supervisor de proceso o un monitor de disponibilidad puede consultar. La misma alcanzabilidad se comprueba una vez al arrancar, y el proceso se niega a arrancar si no puede alcanzar la base de datos, así una mala configuración se manifiesta de inmediato en vez de en la primera petición.

## Logging (`logs.py`)

`logging` de la librería estándar, una configuración compartida aplicada al importar: consola (stdout) + un archivo rotativo (`backend/logs/panicbutton.log`, 5 MB × 3 backups, en `.gitignore`). `LOG_LEVEL` define la severidad mínima para ambos handlers — `DEBUG`/`INFO`/`WARNING`/`ERROR`/`CRITICAL`, por defecto `INFO` si no está definida o está mal escrita. Cada módulo tiene su propio logger nombrado vía `get_logger(__name__)`, así las líneas de log muestran de qué módulo vienen. Cada línea lleva además un id de petición corto, asignado por petición por el middleware de `main.py` y heredado por las tareas en segundo plano que esa petición lanza, así el log de una alerta de pánico (y su envío por email/Telegram) se puede seguir de principio a fin aunque otras peticiones se intercalen. El propio logging de peticiones de `httpx` está fijado en `WARNING`, para que la URL de la API de Telegram — que incluye el token del bot — nunca acabe en el archivo de log.

## Feature flags — `GET /features`

```json
{"telegram": true, "max_contacts": 4}
```

`telegram` indica si este despliegue tiene Telegram completamente configurado (tanto `TELEGRAM_BOT_TOKEN` *como* `TELEGRAM_BOT_USERNAME` definidos — cualquiera de los dos solo significa que un contacto que intente vincular Telegram se toparía con un enlace roto). `max_contacts` es el tope de contactos de emergencia, servido desde el backend para que la app aplique el mismo número que el backend en vez de fijarlo por su cuenta. Sin autenticación, cacheado del lado del cliente durante la sesión de la app (`app/src/lib/features.js`) — se usa para ocultar por completo la UI de Telegram en un despliegue sin bot configurado, en vez de mostrar una función que simplemente fallaría.

## Script de mantenimiento

```bash
uv run scripts/purge_unconfirmed_users.py
```

Borra cuentas que siguen sin confirmar 24h después del registro. Seguro por construcción: el login está bloqueado antes de confirmar, así que una cuenta sin confirmar nunca puede tener contactos ni alertas — no hay nada que este script pudiera borrar que algo más referencie. Pensado para correr periódicamente (cron o similar); no está conectado a la API ni se ejecuta automáticamente desde nada en este repositorio.
