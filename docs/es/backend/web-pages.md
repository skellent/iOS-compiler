# Páginas web renderizadas por el servidor

La mayor parte de este backend responde JSON. Tres rutas responden a un navegador real en cambio — `Pages.Render` (`modules/pages.py`) es el pequeño wrapper de Jinja detrás de todas ellas:

```python
class Pages:
    Render(template: str, context: dict) -> str
```

Renderiza una plantilla de `templates/web/` y devuelve un string plano; el router que la llama la envuelve en `HTMLResponse` con el código de estado que corresponda (`200`, `401`, `404`). `pages.py` no sabe qué es `/static` ni que algo enlaza ahí — eso es exclusivamente responsabilidad de `main.py`.

## Las tres páginas

| Ruta | Plantilla | Renderizada por | Cuándo |
|---|---|---|---|
| `GET /` | `landing.html.j2` | `root()` de `main.py` | Quien abra directamente la URL base de la API |
| `GET /dashboard` | `dashboard.html.j2` | `routers/dashboard.py` | Al seguir el enlace "Open Dashboard" de la landing |
| `GET /auth/confirm/{token}`, `GET /contacts/confirm/{token}`, `GET /alerts/view/{token}` (casos de error) | `confirmation_result.html.j2` | el router correspondiente | Alguien haciendo clic en un enlace dentro de un correo |

Tanto `landing` como `dashboard` se renderizan con `{"contact_email": get_credentials()['email']['from']}` — la misma dirección desde la que `mail.py` realmente envía, no una segunda hardcodeada, así el enlace "Contact us" del footer y la dirección desde la que un contacto realmente recibe correo nunca pueden desincronizarse.

## `landing.html.j2` — también la página de descarga de la app

Hero con un botón "Download APK" (`/static/downloads/panic-button.apk`) junto a un botón deshabilitado "Google Play — coming soon", una grilla de features, un resumen de configuración, y un footer con "Contact us" (`mailto:`) y "About us" (`https://keycodelogics.com/`). Un ícono de engranaje abre un diálogo de configuración de Tema/Idioma, respaldado en `localStorage` — pero el contenido central de la página renderiza por completo sin JavaScript.

`backend/static/downloads/panic-button.apk` es un artefacto de build — `./gradlew assembleRelease` en `app/android`, copiado acá por quien despliega, igual que `app/www` (ver [`../app/architecture.md`](../app/architecture.md)). **Cualquier cambio a nivel nativo de Android — un nuevo plugin de Capacitor, un permiso de manifest, una dependencia nativa nueva — necesita que este archivo se regenere y redespliegue.** El mecanismo de recarga en vivo descrito en `app/architecture.md` solo cubre `app/www` (HTML/CSS/JS); no puede alcanzar código compilado dentro del binario ya instalado, así que un dispositivo que ya tiene la app instalada no verá un cambio a nivel nativo hasta que instale un APK nuevo.

## `dashboard.html.j2` — una pequeña app del lado del cliente

A diferencia de las otras dos, esta hace su trabajo real en el navegador: `POST /auth/login` (el token se guarda en `sessionStorage`, no en `localStorage`, para que no sobreviva más que la pestaña) seguido de `GET /alerts`, renderizado en tarjetas de alerta que muestran cuándo/dónde disparó cada alerta y, por cada contacto notificado, si ya abrió su `map_url`. Reutiliza los mismos endpoints `/auth`/`/alerts` que usa la app móvil — sin superficie de API específica para el dashboard.

## `confirmation_result.html.j2` — una sola plantilla, todos los resultados

`{success: bool, message: str}` elige un check o una X (SVG inline, con una pequeña animación de trazo) y el texto del cuerpo — cubre confirmación de cuenta, confirmación de contacto y fallas de vista de alerta sin archivos HTML casi duplicados para cada caso.

## CSS/JS compartido: tema, idioma, y el ícono propio de la app

`landing` y `dashboard` usan ambas `<img class="brand-mark" src="/static/img/brand-mark.png">` — el mismo PNG usado en las pantallas de auth de la propia app (`app/www/assets/brand-mark.png`), copiado a `backend/static/img/` — en vez de un placeholder dibujado en CSS. El tema (Light/Dark/Auto) se guarda bajo la *misma* clave de `localStorage` en ambas páginas (`panicbutton.site.theme`), así que una elección hecha en cualquiera de las dos aplica en ambas la próxima vez que se cargue cualquiera. El idioma (solo `landing.js` — el dashboard todavía no tiene strings traducidos) es independiente (`panicbutton.landing.lang`).

## `/static` vs `/app`

```python
app.mount("/static", StaticFiles(directory=BACKEND_DIR / "static"), name="static")
...
app.mount("/app", _NoCacheStaticFiles(directory=APP_WWW_DIR, html=True), name="app")
```

`/static` es el CSS/JS/imágenes *propios* de este backend (`landing.css`, `dashboard.js`, `brand-mark.png`, el APK) — un mount `StaticFiles` plano, cacheo por default, nada especial. `/app` es la UI compilada de la app móvil (`app/www/`, descrita completa en [`../app/architecture.md`](../app/architecture.md)) — un mount distinto, con una política de cacheo distinta y deliberada:

```python
_LONG_CACHE_SUFFIXES = {".png", ".jpg", ".jpeg", ".svg", ".ico", ".webp"}

class _NoCacheStaticFiles(StaticFiles):
    def file_response(self, full_path, stat_result, scope, status_code=200):
        response = super().file_response(full_path, stat_result, scope, status_code)
        if Path(full_path).suffix in _LONG_CACHE_SUFFIXES:
            response.headers["Cache-Control"] = "public, max-age=604800"
        else:
            response.headers["Cache-Control"] = "no-cache"
        return response
```

`index.html`/CSS/JS reciben `Cache-Control: no-cache` — el WebView debe revalidar con el servidor en cada petición (un `304` barato cuando nada cambió) en vez de servir en silencio una copia vieja desde disco, lo que anularía por completo el propósito de `GET /app/manifest` (ver el flujo de chequeo de actualización en `app/architecture.md`). Las imágenes cosméticas (favicon, brand mark) reciben en cambio un cacheo real de una semana: un ícono desactualizado por unos días es inofensivo, y forzar cada imagen por el mismo tratamiento de revalidar-en-cada-petición resultó ser puro overhead — un `304` igual cuesta un viaje de ida y vuelta completo, y se notaba como volumen de peticiones innecesario en los logs de producción para algo que casi nunca cambia.

`GET /app/manifest` se registra antes de `app.mount("/app", ...)` — Starlette compara las rutas en el orden en que se registraron, así que la ruta exacta gana para esa URL puntual antes de que el mount siquiera la vea (ver [`architecture.md`](architecture.md)).
