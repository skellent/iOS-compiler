# PanicSwitch

A panic buttom emergency call

![badge](https://shieldcn.dev/badge/Python->=%203.12-abcde3.svg?size=default&logo=python)
![badge](https://shieldcn.dev/badge/MariaDB-abcde3.svg?size=default&theme=emerald&logo=mariadb&color=08933b)
![badge](https://shieldcn.dev/badge/Debian-abcde3.svg?size=default&logo=debian&logoColor=fdfeff&color=ef4444)
![badge](https://shieldcn.dev/badge/JavaScript-abcde3.svg?size=default&logo=javascript&logoColor=fdfeff&color=efcf44)
![badge](https://shieldcn.dev/badge/Capacitor.js-Android%20&%20iOS-abcde3.svg?size=default&logo=ri%3AFaMobileAlt&logoColor=fdfeff&color=8b5cf6)

# Instalación y Ejecución del Backend

## 1. Configurar MariaDB

El proceso de MariaDB debe inicializarse y debe configurarse el usuario y base de datos correspondiente, el usuario y la contraseña serán definidos por el administrador del servidor y dichas credenciales deben ser escritas en un .env dentro del directorio backend al momento de montarlo, vease .envexample para comprender las variables requeridas. Este proceso debe realizarse como usuario root al acceder a la consola de MariaDB mediante `mariadb -u root`

A su vez, en el directorio ./backend/querys está presente el código SQL a ejecutar para crear las tablas de la base de datos, junto con la antes mencionada creación del usuario y base, también cuenta con ejemplos de cómo funcionarán los INSERT.

## 2. Preparar el Entorno
- Primero hay que instalar Python (>=3.12) junto con su versión correspondiente de pip
- Luego mediante el comando `pip install uv` para poder instalar un gestor más versatil
- Al momento de haberse instalado uv, dirigirse al directorio ./backend y ejecutar `uv sync`, el gestor automáticamente creará un entorno virtual y instalará las dependencias (Si MariaDB no está funcionando al momento de este paso, saltará un error de building por la librería de mariadb)
- Crear un archivo .env en el directorio backend y utilizar .envexample como plantilla para llenar las credenciales
- Ejecutar `uv run uvicorn main:app --reload`
  
> Para pruebas puede usar simplemente `uv run main.py`

> En caso de haber algún problema con la versión de Python del servidor, uv puede solucionarlo indicandole qué versión instalar. Igualmente las librerías/dependencias listadas en pyproject.toml son compatibles con Python 3.12 en adelante

### Estructura de .env esperada

```env
USERNAME=''
PASSWORD=''
HOST=''
PORT=
DATABASE=''
JWT_SECRET_KEY=''
SMTP_USER=''
SMTP_PASSWORD=''
SMTP_HOST='smtp.gmail.com'
SMTP_PORT=587
API_BASE_URL='http://127.0.0.1:8000'
```

`JWT_SECRET_KEY` es la clave con la que el backend firma y verifica los tokens de sesión (JWT) que emite `POST /auth/login` — ver `docs/backend/token.md` para el detalle de cómo se usa. No es una credencial de MariaDB, así que no sale de la configuración de la base de datos del paso 1: hay que generarla aparte.

`SMTP_USER`/`SMTP_PASSWORD` son la cuenta de Google Workspace (`soporte@keylogics.com`) desde la que se mandan los correos de confirmación de contactos de emergencia, y `SMTP_PASSWORD` es específicamente una **contraseña de aplicación** de 16 caracteres (`myaccount.google.com/apppasswords`), no la contraseña real de la cuenta — Google no acepta autenticación SMTP básica en cuentas de Workspace desde marzo de 2025. Requiere verificación en 2 pasos activa en esa cuenta y que el administrador de Workspace permita crear contraseñas de aplicación. Ver `docs/backend/correo.md` para el detalle completo (incluyendo la alternativa con OAuth2, en la rama `feature/correo-oauth2`, si el cliente prefiere no depender de contraseñas de aplicación). `API_BASE_URL` es la URL pública con la que la API arma el link de confirmación que viaja en esos correos — en producción, el dominio real detrás de nginx (ver `NGINX.md`).

#### Generar `JWT_SECRET_KEY` para producción

Tiene que ser una cadena larga y aleatoria, no una frase elegida a mano — cualquiera que la conozca puede firmar tokens válidos para cualquier usuario del sistema. Para generar una en la máquina donde se vaya a desplegar el backend, con `uv` ya instalado y `uv sync` ya ejecutado (paso 2), alcanza con:

```bash
uv run python -c "import secrets; print(secrets.token_hex(32))"
```

Esto imprime una cadena hexadecimal de 64 caracteres (256 bits de entropía) que se pega tal cual como valor de `JWT_SECRET_KEY` en el `.env` de ese entorno. Cada entorno (desarrollo, producción, etc.) debería tener su propio secreto generado por separado — no reutilizar el mismo valor entre ellos, y nunca versionarlo (por eso `.env` está en `.gitignore`).

# Uso de la API

Con el servidor corriendo, la API expone rutas de registro y login (`/auth`), gestión del usuario autenticado (`/usuarios/me`) y contactos de emergencia (`/contactos`). La guía completa de cada endpoint, con ejemplos de consumo en Python y JavaScript (pensados para el futuro cliente Capacitor), está en [`backend/API.md`](backend/API.md). Las decisiones de diseño detrás de cada módulo del backend (por qué JWT, por qué esa estructura de rutas, etc.) están documentadas una por una en [`docs/backend/`](docs/backend/).

# Preparación y Compilación de Aplicaciones

> Pendiente por comenzar el desarrollo de la aplicación y detalles técnicos
> Será desarrollada con capacitor.js y estará disponible para Android y iOS

# Historial de Commits

```mermaid
gitGraph
   commit id: "83b5d3e Initial commit"
   branch devs
   checkout devs
   commit id: "bd81c9c Preparación del entorno"
   commit id: "905986f Documentación + servidor de prueba"
   branch testing
   checkout testing
   commit id: "1392a31 Login JWT + Contactos + fix duplicados"
   commit id: "872b6db Documentación al día"
   commit id: "89d570e JWT_SECRET_KEY en README"
   checkout devs
   merge testing id: "bea6008 Merge testing -> devs"
```

- **`83b5d3e` — Initial commit** (rama `main`): primer commit del repositorio, solo el `README.md` inicial. `main` no volvió a avanzar desde acá; todo el desarrollo ocurre en `devs` (y, temporalmente, en ramas como `testing`).
- **`bd81c9c` — Preparación del entorno de Python**: primer esqueleto funcional del backend — `pyproject.toml`, la clase `Cursor` para hablar con MariaDB, `credenciales.py`, y los scripts SQL de creación de tablas. Se corroboró que la conexión a la base de datos funcionaba correctamente con un `.env` real.
- **`905986f` — Redacción de documentación + Servidor de prueba**: primer endpoint de negocio (`POST /registrar/usuario`), `Guard` para el hash de contraseñas con bcrypt, y el primer lote de documentación en `docs/backend/` (`credenciales.md`, `cursor.md`, `guard.md`).
- **`1392a31` — Login con JWT, CRUD de Contactos, edición de Usuarios y fix de duplicados** (mergeado desde `testing`): corrige el bug de insertar datos que chocan con un `UNIQUE` existente (ahora responde `409` en vez de un `500` sin manejar), estandariza las rutas bajo `/auth`, `/usuarios` y `/contactos`, agrega login con JWT, y el CRUD completo de contactos de emergencia y edición de usuarios.
- **`872b6db` — Documentación al día con JWT, routers y CRUD de Contactos/Usuarios** (mergeado desde `testing`): actualiza toda la documentación de `docs/backend/` para que refleje el código del commit anterior, y agrega `backend/API.md` con ejemplos de uso en Python y JavaScript.
- **`89d570e` — Documentar JWT_SECRET_KEY y uso de la API en el README** (mergeado desde `testing`): agrega al README los pasos para generar el secreto de JWT en producción y enlaza la documentación de la API.
- **`bea6008` — Merge testing → devs**: integra los tres commits anteriores (desarrollados y revisados primero en la rama local `testing`) a `devs`, trayendo todo el trabajo de esta etapa a la rama principal de desarrollo.
