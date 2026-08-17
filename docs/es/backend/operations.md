# Operaciones

Variables de entorno, logging, feature flags, y el único script de mantenimiento — todo lo que necesita un operador (no alguien leyendo el código) para correr esto.

## Variables de entorno (`credentials.py`)

`get_credentials()` lee `.env` (`python-dotenv`, `override=True` — ver nota abajo) y devuelve un solo dict, agrupado por tema:

| Grupo | Variables | Notas |
|---|---|---|
| Base de datos | `USERNAME`, `PASSWORD`, `HOST`, `PORT`, `DATABASE` | Ver [`database.md`](database.md) |
| JWT | `JWT_SECRET_KEY` | Firma/verifica tokens de sesión + confirmación, ver [`auth.md`](auth.md) |
| SMTP | `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_HOST` (default `smtp.gmail.com`), `SMTP_PORT` (default `587`), `SMTP_FROM` (por defecto igual a `SMTP_USER`) | Ver [`notifications.md`](notifications.md) |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | Todas opcionales — sin definir simplemente significa que la función está apagada |
| General | `API_BASE_URL` (default `http://127.0.0.1:8000`), `APP_MODE` (default `Debug`), `LOG_LEVEL` (default `INFO`) | |

`override=True` importa específicamente en Windows: el sistema operativo predefine su propia variable de entorno `USERNAME` (la cuenta de Windows con la que se inició sesión), y `load_dotenv()` deja intactas las variables de entorno existentes por defecto — sin `override=True`, el propio `USERNAME` del `.env` (el usuario de MariaDB) pierde en silencio contra la cuenta de Windows que esté corriendo el proceso.

`SMTP_PASSWORD` es una **contraseña de aplicación** de Google Workspace de 16 caracteres, no la contraseña real de la cuenta (Gmail no acepta autenticación SMTP básica en cuentas Workspace desde marzo de 2025) — se genera en `myaccount.google.com/apppasswords` con verificación en 2 pasos activa. `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME` vienen del `@BotFather` de Telegram (`/newbot`); `TELEGRAM_WEBHOOK_SECRET`, igual que `JWT_SECRET_KEY`, es un string aleatorio que este despliegue inventa:

```bash
uv run python -c "import secrets; print(secrets.token_hex(32))"
```

Generar un valor separado por entorno (dev, prod) para ambos secretos — nunca reutilizar uno entre ellos, nunca commitear `.env` (ya está en `.gitignore`).

## Logging (`logs.py`)

`logging` de la librería estándar, una configuración compartida aplicada al importar: consola (stdout) + un archivo rotativo (`backend/logs/panicbutton.log`, 5 MB × 3 backups, en `.gitignore`). `LOG_LEVEL` define la severidad mínima para ambos handlers — `DEBUG`/`INFO`/`WARNING`/`ERROR`/`CRITICAL`, por defecto `INFO` si no está definida o está mal escrita. Cada módulo tiene su propio logger nombrado vía `get_logger(__name__)`, así las líneas de log muestran de qué módulo vienen.

## Feature flags — `GET /features`

```json
{"telegram": true}
```

Un flag hoy: si este despliegue tiene Telegram completamente configurado (tanto `TELEGRAM_BOT_TOKEN` *como* `TELEGRAM_BOT_USERNAME` definidos — cualquiera de los dos solo significa que un contacto que intente vincular Telegram se toparía con un enlace roto). Sin autenticación, cacheado del lado del cliente durante la sesión de la app (`app/src/lib/features.js`) — se usa para ocultar por completo la UI de Telegram en un despliegue sin bot configurado, en vez de mostrar una función que simplemente fallaría.

## Script de mantenimiento

```bash
uv run scripts/purge_unconfirmed_users.py
```

Borra cuentas que siguen sin confirmar 24h después del registro. Seguro por construcción: el login está bloqueado antes de confirmar, así que una cuenta sin confirmar nunca puede tener contactos ni alertas — no hay nada que este script pudiera borrar que algo más referencie. Pensado para correr periódicamente (cron o similar); no está conectado a la API ni se ejecuta automáticamente desde nada en este repositorio.
