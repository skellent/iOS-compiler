# Pantallas

Siete pantallas, un router por hash (`src/main.js`), sin estado compartido más allá de "quién tiene sesión iniciada" (`src/lib/session.js`, cacheado en memoria + `@capacitor/preferences`).

```mermaid
flowchart LR
    login["Login\n#/login"] <--> register["Registro\n#/register"]
    register --> confirmMail["\"Revisa tu correo\"\n(no es una ruta)"]

    login -- "al tener éxito" --> home["Home\n#/home"]

    subgraph "Nav inferior (con sesión iniciada)"
        home
        contacts["Contactos\n#/contacts"]
        profile["Perfil\n#/profile"]
    end

    profile --> about["Acerca de\n#/about"]
    profile --> help["Ayuda\n#/help"]
    profile -- "cerrar sesión" --> login
```

`ROUTES` en `main.js` marca cada ruta como `public` (login/register — redirige a home a quien ya tiene sesión) o no (redirige a login a quien no la tiene); `about`/`help` no están en la nav inferior, solo se llega desde Perfil.

## Login / Registro

`login.js`, `register.js` — formularios simples, `Api.login`/`Api.register`. El registro no inicia sesión automáticamente después (el backend igual bloquea el login antes de confirmar, ver [`../backend/auth.md`](../backend/auth.md)) — muestra una pantalla de "revisa tu correo" en su lugar. Ambas usan el `<select>` de código de país de `phone.js` + un input de solo dígitos, combinados en un string tipo E.164 (`combinePhone`) antes de llamar a la API.

## Home — el botón de pánico

`home.js`. Un gesto de mantener presionado (`HOLD_DURATION_MS = 1400`), rastreado con `requestAnimationFrame` que llena un anillo SVG alrededor del botón en vez de un timer plano; soltar antes cancela. Al completar la espera:

1. `getCurrentCoordinates()` (`lib/geolocation.js`, envuelve `@capacitor/geolocation`) — fix de GPS, timeout de 15s
2. `Api.createAlert({ latitude, longitude })`
3. Éxito → check + toast; falla → estado de error + animación de sacudida + toast con el mensaje de error específico

Un chip de estado sobre el botón muestra cuántos contactos confirmados realmente serían notificados (`Api.listContacts()`, contado del lado del cliente) — feedback visible de que el botón no está por dispararse al vacío.

## Contactos

`contacts.js` — lista + agregar/editar en un bottom sheet (`lib/sheet.js`, un modal que se siente nativo, no una navegación completa). "Agregar" ofrece elegir desde la agenda del dispositivo (`lib/contactsPicker.js`, selector nativo — la app nunca obtiene acceso masivo a la agenda) o llenar el formulario a mano. El cliente aplica el mismo `MAX_CONTACTS = 4` que aplica el backend (`routers/contacts.py`) solo para que la UI deje de ofrecer "agregar" antes de que el round-trip devuelva un 400 — el backend sigue siendo la fuente de verdad real. Cada fila muestra dos íconos de estado de canal independientes (email `confirmed`, Telegram `telegram_linked`) cuando Telegram está habilitado para el despliegue (`lib/features.js`); editar un contacto puede activar/desactivar su vínculo de Telegram directamente.

## Perfil

`profile.js` — editar nombre/teléfono/email/contraseña (solo se envían los campos cambiados, mediante una comparación tipo `diffFields`), más tres controles de preferencias que persisten vía `@capacitor/preferences` y aplican de inmediato sin recargar la página:

- **Idioma** — `LANGUAGES` de `lib/i18n.js` (12 idiomas), `changeLanguage()` vuelve a renderizar la pantalla actual
- **Tema** — Auto/Claro/Oscuro, `lib/theme.js`
- **Color de acento** — seis presets más un `<input type="color">` nativo para un hex personalizado; `theme.js` deriva toda la escala de tonos `--primary-900`…`--primary-300` a partir solo del tono/saturación vía matemática HSL, con distintas curvas de luminosidad para claro vs. oscuro (así, por ejemplo, `--primary-400` se mantiene legible como texto tanto sobre fondo oscuro como sobre blanco)

Cerrar sesión, y enlaces a Acerca de/Ayuda.

## Acerca de / Ayuda

`about.js`, `help.js` — pantallas informativas estáticas, ambas usando el layout compartido `.info-screen` con un botón de volver a Perfil. Ayuda es una lista fija de secciones tipo preguntas y respuestas (`account`, `panic`, `contacts`, `channels`, `profile`), todo strings traducidos — sin contenido dinámico.

## Piezas compartidas

| Módulo | Propósito |
|---|---|
| `lib/api.js` | Wrapper de `fetch` — agrega `Authorization` cuando `auth: true`, extrae un mensaje de error legible del formato de error del backend, lanza `ApiError` |
| `lib/dom.js` | `escapeHtml`, `setLoading` (estado de spinner en botones), `shake` (animación de error en formularios) |
| `lib/toast.js` | Notificaciones transitorias de éxito/error/info |
| `lib/sheet.js` | Modal de bottom sheet usado por los formularios de agregar/editar de Contactos |
| `lib/icons.js` | Set de íconos SVG inline estilo Material |
| `lib/features.js` | Cachea `GET /features` durante la sesión de la app — ver [`../backend/operations.md`](../backend/operations.md) |
