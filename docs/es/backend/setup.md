# Instalación y primer arranque

Lleva una máquina nueva desde cero hasta un backend en ejecución.

## Requisitos

- **Python 3.12+**
- **[uv](https://docs.astral.sh/uv/)** — el gestor/ejecutor usado en todo el proyecto (`uv run …`).
- **MariaDB 10.6+** (o MySQL compatible) accesible desde el backend.
- Solo para compilar la app móvil: **[Bun](https://bun.sh/)** y el Android SDK.

## 1. Código y dependencias

```bash
git clone <repo-url> panicbutton.me
cd panicbutton.me/backend
uv sync            # instala las dependencias del backend en un .venv local
```

## 2. Provisionar la base de datos

Crea la base y un usuario, luego las tablas. El SQL vive en `backend/queries/`.

```bash
mariadb -u root -p
```

```sql
-- de queries/creation.sql — ajusta los placeholders
CREATE DATABASE panicbutton CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'panic'@'localhost' IDENTIFIED BY 'una-contraseña-fuerte';
GRANT ALL PRIVILEGES ON panicbutton.* TO 'panic'@'localhost';
FLUSH PRIVILEGES;
```

Luego carga el esquema:

```bash
mariadb -u panic -p panicbutton < queries/tables.sql
```

`queries/tables.sql` es la fuente de verdad para una instalación nueva — ya incluye cada columna (los cuatro canales, el `alert_notifications.contact_name` denormalizado, etc.). Los archivos en `queries/migrations/` son solo para actualizar una base **existente**; una instalación nueva desde `tables.sql` no necesita ninguno.

## 3. Configurar `.env`

Copia el ejemplo y complétalo:

```bash
cp .envexample .env
```

Lo mínimo para arrancar es el bloque de base de datos y un secreto JWT. Cada variable está documentada en [operations.md](operations.md); lo esencial:

```bash
USERNAME='panic'
PASSWORD='una-contraseña-fuerte'
HOST='127.0.0.1'
PORT=3306
DATABASE='panicbutton'

JWT_SECRET_KEY='<32+ bytes aleatorios, ver abajo>'

API_BASE_URL='http://127.0.0.1:8000'
APP_MODE='Debug'
```

Genera el secreto JWT (nunca lo reutilices entre entornos, nunca commitees `.env`):

```bash
uv run python -c "import secrets; print(secrets.token_hex(32))"
```

Email, Telegram, WhatsApp y SMS son todos **opcionales** — deja sus variables vacías para correr sin ellos. Para desarrollar contra una cuenta SMTP real sin enviar correos, pon `SMTP_ENABLED='false'` (dry-run: registra en vez de enviar). Los canales de Twilio tienen el mismo interruptor (`TWILIO_WHATSAPP_ENABLED`, `TWILIO_SMS_ENABLED`).

> **Nota Windows:** el SO define su propia variable `USERNAME`. `.env` se carga con `override=True` justamente para que el `USERNAME` de MariaDB gane sobre el de la cuenta de Windows.

## 4. Ejecutarlo

```bash
uv run uvicorn main:app --host 127.0.0.1 --port 8000
```

Al arrancar, el backend verifica la conexión a la base (y se niega a arrancar si no la alcanza) y, si hay un bot de Telegram configurado, registra su webhook. Comprueba que está vivo:

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok","database":true}
```

- La documentación de la API (Swagger) está en `/docs` salvo que `APP_MODE='Deploy'`.
- La landing está en `/`, el panel de alertas en `/dashboard`.

## 5. Detrás de un proxy inverso (producción)

Corre Uvicorn con proxy headers para que las IP de cliente (que usa el limitador) y el HTTPS se vean bien:

```bash
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips='*'
```

Termina TLS en nginx y reenvía al backend. `API_BASE_URL` debe ser la URL pública **HTTPS** (Telegram y los enlaces de confirmación/opt-in dependen de ella — ver [domain-change.md](domain-change.md)). Una buena regla de endurecimiento es negar el acceso a dotfiles:

```nginx
location ~ /\.(?!well-known) { deny all; return 404; }
```

## 6. Compilar la app móvil (opcional)

La app carga su UI del backend, pero el bundle JS se compila con Bun:

```bash
cd ../app
bun install
API_BASE_URL='https://tu-dominio' bun run build   # genera www/js/main.js
```

Ver [app/architecture.md](../app/architecture.md) para el modelo app-online y cuándo hace falta recompilar el APK.

## Siguientes pasos

- [Configuración de Twilio](twilio.md) para encender WhatsApp y SMS.
- [Operaciones](operations.md) para la referencia completa de variables, logging y el script de mantenimiento.
