# API de PanicSwitch — Guía de uso

Este documento explica cómo consumir la API desde un cliente externo (en particular, pensando en la futura aplicación Capacitor), con ejemplos equivalentes en Python y JavaScript. Para entender *por qué* la API está construida como está (decisiones de diseño, seguridad, estructura interna), ver `docs/backend/` — este archivo se enfoca solo en *cómo usarla* desde afuera.

## Antes de empezar

En desarrollo local, la API corre en `http://127.0.0.1:8000` (o el host/puerto que le indiques a `uvicorn`, ver el README principal). Todos los ejemplos de este documento asumen esa URL base; en producción habría que reemplazarla por el dominio real donde se despliegue el backend.

Todas las peticiones que llevan cuerpo (`POST`, `PUT`) esperan y devuelven **JSON** (`Content-Type: application/json`).

## Flujo general

```mermaid
sequenceDiagram
    participant App as App (Capacitor)
    participant API

    App->>API: POST /auth/registro (nombre, telefono, correo, contraseña)
    API-->>App: 201 Created

    App->>API: POST /auth/login (correo, contraseña)
    API-->>App: 200 OK { access_token, token_type }
    Note over App: guardar access_token

    App->>API: GET /usuarios/me<br/>Authorization: Bearer access_token
    API-->>App: 200 OK { id, nombre, telefono, correo }

    App->>API: POST /contactos<br/>Authorization: Bearer access_token
    API-->>App: 201 Created
```

En resumen: **te registrás una vez**, **iniciás sesión** para obtener un token, y **reenviás ese token** en todas las peticiones que necesiten saber quién sos. El token no se guarda en el servidor (ver `docs/backend/token.md`) — quien lo pierde, tiene que loguearse de nuevo para conseguir uno nuevo, no hay un "recuperar sesión" del lado del backend.

## Autenticación

### `POST /auth/registro`

Crea una cuenta nueva. No requiere autenticación (obviamente: todavía no existe la cuenta).

**Cuerpo de la petición:**

```json
{
  "nombre": "María Pérez",
  "telefono": "+584241234567",
  "correo": "maria@example.com",
  "contraseña": "unaContraseñaSegura"
}
```

**Respuestas:**

| Código | Cuándo ocurre |
|--------|----------------|
| `201`  | Cuenta creada correctamente. |
| `409`  | Ya existe una cuenta con ese `telefono` o ese `correo`. |
| `422`  | Falta algún campo, o tiene el tipo incorrecto (por ejemplo, `telefono` como número en vez de texto). |

Registrarse **no** inicia sesión automáticamente: después de un `201` hay que llamar a `/auth/login` para obtener un token.

### `POST /auth/login`

Verifica las credenciales y devuelve un token.

**Cuerpo de la petición:**

```json
{
  "correo": "maria@example.com",
  "contraseña": "unaContraseñaSegura"
}
```

**Respuesta (`200`):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

Si el correo no existe o la contraseña no coincide, la respuesta es `401 Unauthorized` con un mensaje genérico ("Correo o contraseña incorrectos") — a propósito no distingue cuál de las dos cosas falló, para no revelar qué correos están registrados (ver `docs/backend/routers.md`).

### Cómo usar el token

Todas las rutas descritas más abajo, salvo las dos de `/auth`, requieren mandar el token en el header `Authorization`, con el esquema `Bearer`:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Si el header falta, está mal formado, o el token expiró o es inválido, la API responde `401 Unauthorized` antes de ejecutar cualquier lógica de negocio (ver `docs/backend/dependencies.md`). El token expira a las 24 horas de haberse emitido (ver `docs/backend/token.md`); pasado ese tiempo, hay que volver a loguearse — no existe (todavía) un mecanismo de refresco automático.

## Endpoints de Usuario

### `GET /usuarios/me`

Devuelve los datos del usuario dueño del token. No recibe ningún parámetro: "de quién son los datos" lo decide el token, nunca una URL con un `id` (ver `docs/backend/routers.md`).

**Respuesta (`200`):**

```json
{
  "id": 5,
  "nombre": "María Pérez",
  "telefono": "+584241234567",
  "correo": "maria@example.com"
}
```

Nótese que nunca se devuelve la contraseña ni su hash.

### `PUT /usuarios/me`

Edita al usuario autenticado. Acepta **cualquier subconjunto** de estos campos — solo se actualiza lo que se envía, el resto queda igual:

```json
{
  "nombre": "Nuevo Nombre"
}
```

Los campos posibles son `nombre`, `telefono`, `correo` y `contraseña` (si se manda `contraseña`, se re-hashea en el servidor; nunca hace falta mandar el hash, solo el texto plano nuevo). La respuesta (`200`) es el usuario completo ya actualizado, con la misma forma que `GET /usuarios/me`.

| Código | Cuándo ocurre |
|--------|----------------|
| `200`  | Actualización exitosa. |
| `400`  | El cuerpo no traía ningún campo para actualizar (`{}`). |
| `409`  | El nuevo `telefono` o `correo` ya pertenece a otra cuenta. |
| `401`  | Token ausente, inválido o expirado. |

## Endpoints de Contactos

Los contactos son las personas que deben notificarse cuando el usuario activa una alerta. Todos los endpoints de este grupo requieren el header `Authorization` y solo afectan a los contactos del usuario dueño del token — no existe forma de leer o editar contactos de otra cuenta.

### `POST /contactos`

Crea un contacto de emergencia nuevo.

**Cuerpo de la petición:**

```json
{
  "nombre": "Carlos Pérez",
  "telefono": "+584161234567",
  "correo": null
}
```

`correo` es opcional (puede omitirse o mandarse `null`); `nombre` y `telefono` son obligatorios. Respuesta: `201` sin cuerpo relevante.

Si se manda `correo`, la API dispara en segundo plano un correo de confirmación a esa dirección (no bloquea la respuesta `201`, ver `docs/backend/correo.md`), con un link a `GET /contactos/confirmar/{token}`. Mientras el contacto no confirme haciendo clic en ese link, `confirmado` sigue en `false` en `GET /contactos` (ver más abajo). Si no se manda `correo`, no hay forma de confirmarlo todavía y queda en `false` indefinidamente.

### `GET /contactos`

Lista todos los contactos del usuario autenticado.

**Respuesta (`200`):**

```json
[
  {
    "id": 1,
    "nombre": "Carlos Pérez",
    "telefono": "+584161234567",
    "correo": null,
    "confirmado": false
  }
]
```

`confirmado` indica si ese contacto ya aceptó recibir alertas en su nombre; hoy siempre llega en `false`, porque el flujo de confirmación todavía no está implementado (ver `docs/backend/sql.md`).

### `GET /contactos/confirmar/{token}`

Es el único endpoint de este grupo que **no** requiere el header `Authorization` — a propósito: a este endpoint se llega haciendo clic en el link del correo de confirmación (ver `POST /contactos` más arriba), no desde una sesión iniciada en la app. El `token` de la URL no es el mismo tipo de token que `access_token` (no sirve para autenticarse contra ningún otro endpoint, y viceversa: un `access_token` de sesión no sirve acá).

**Respuestas:**

| Código | Cuándo ocurre |
|--------|----------------|
| `200`  | El contacto quedó marcado como confirmado. Cuerpo: `{"mensaje": "Contacto confirmado exitosamente"}`. |
| `401`  | El token es inválido, no es del tipo esperado, o ya expiró (vence a los 7 días de emitido). |
| `404`  | El token era válido pero el contacto al que apunta ya no existe. |

### `PUT /contactos/{id}`

Edita un contacto existente, identificado por su `id` (el mismo que devuelve `GET /contactos`). Igual que `PUT /usuarios/me`, solo acepta los campos que se quieran cambiar:

```json
{
  "telefono": "+584169998877"
}
```

| Código | Cuándo ocurre |
|--------|----------------|
| `200`  | Actualización exitosa; devuelve el contacto completo actualizado. |
| `400`  | El cuerpo no traía ningún campo para actualizar. |
| `404`  | No existe un contacto con ese `id` **perteneciente al usuario autenticado** (incluye el caso de que el `id` exista pero sea de otra cuenta — a propósito no se distingue, ver `docs/backend/routers.md`). |
| `401`  | Token ausente, inválido o expirado. |

## Ejemplos en Python

Usando la librería `requests` (`pip install requests` o, si el cliente también fuera un proyecto `uv`, `uv add requests`):

```python
import requests

BASE_URL = "http://127.0.0.1:8000"


def registrar(nombre, telefono, correo, contraseña):
    resp = requests.post(f"{BASE_URL}/auth/registro", json={
        "nombre": nombre,
        "telefono": telefono,
        "correo": correo,
        "contraseña": contraseña,
    })
    resp.raise_for_status()  # lanza una excepción si el código no es 2xx
    return resp.json()


def login(correo, contraseña):
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "correo": correo,
        "contraseña": contraseña,
    })
    resp.raise_for_status()
    return resp.json()["access_token"]


def obtener_mi_usuario(token):
    resp = requests.get(f"{BASE_URL}/usuarios/me", headers={
        "Authorization": f"Bearer {token}",
    })
    resp.raise_for_status()
    return resp.json()


def crear_contacto(token, nombre, telefono, correo=None):
    resp = requests.post(f"{BASE_URL}/contactos",
        json={"nombre": nombre, "telefono": telefono, "correo": correo},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()


# Uso:
token = login("maria@example.com", "unaContraseñaSegura")
usuario = obtener_mi_usuario(token)
crear_contacto(token, "Carlos Pérez", "+584161234567")
```

`resp.raise_for_status()` es la forma que tiene `requests` de convertir un código `4xx`/`5xx` en una excepción (`requests.HTTPError`) en vez de dejar que el código siga como si nada — conviene envolver estas llamadas en un `try/except` para mostrarle al usuario final un mensaje apropiado según el código (por ejemplo, distinguiendo un `401` de un `409`).

## Ejemplos en JavaScript (pensados para Capacitor)

Una app Capacitor es, por dentro, una WebView que ejecuta JavaScript/TypeScript estándar — así que la forma más directa de hablar con la API es `fetch`, disponible sin instalar nada:

```javascript
const BASE_URL = "http://127.0.0.1:8000";

async function registrar(nombre, telefono, correo, contraseña) {
  const resp = await fetch(`${BASE_URL}/auth/registro`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, telefono, correo, contraseña }),
  });
  if (!resp.ok) throw new Error(`Error ${resp.status} al registrar`);
  return resp.json();
}

async function login(correo, contraseña) {
  const resp = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo, contraseña }),
  });
  if (!resp.ok) throw new Error(`Error ${resp.status} al iniciar sesión`);
  const data = await resp.json();
  return data.access_token;
}

async function obtenerMiUsuario(token) {
  const resp = await fetch(`${BASE_URL}/usuarios/me`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Error ${resp.status} al obtener el usuario`);
  return resp.json();
}

async function crearContacto(token, nombre, telefono, correo = null) {
  const resp = await fetch(`${BASE_URL}/contactos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ nombre, telefono, correo }),
  });
  if (!resp.ok) throw new Error(`Error ${resp.status} al crear el contacto`);
}

// Uso:
const token = await login("maria@example.com", "unaContraseñaSegura");
const usuario = await obtenerMiUsuario(token);
await crearContacto(token, "Carlos Pérez", "+584161234567");
```

## Consideraciones específicas para Capacitor

Dos cosas a tener en cuenta cuando este cliente deje de ser un ejemplo y pase a ser la app real, ninguna de las dos resuelta todavía del lado del backend:

- **CORS**: en el navegador o en la WebView de Capacitor, las peticiones a un origen distinto al de la app (por ejemplo, la app corre en `capacitor://localhost` y la API en `http://192.168.x.x:8000`) están sujetas a la política CORS del navegador. FastAPI **no** trae CORS habilitado por defecto — hoy la API solo responde sin problemas a peticiones que no dependan de esa política (como los ejemplos de Python de arriba, que no corren en un navegador). Antes de que la app Capacitor pueda hablarle a esta API directamente desde JavaScript, va a hacer falta agregar `CORSMiddleware` en `main.py` con los orígenes permitidos — queda pendiente para cuando arranque el desarrollo de la app (ver `TASK.md`).
- **Dónde guardar `access_token`**: los ejemplos de arriba no muestran dónde persistir el token entre aperturas de la app — `localStorage` funciona pero no está pensado para datos sensibles en un dispositivo móvil. Para la app real, conviene usar un plugin de Capacitor pensado para esto (por ejemplo, `@capacitor/preferences` como mínimo, o una opción de almacenamiento seguro/cifrado si se quiere ir más allá) en vez de `localStorage` a secas.
