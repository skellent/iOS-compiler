# Pantallas de la app

Tres pestañas principales — Inicio, Contactos, Perfil — más login y registro.

## Login y registro

Email + contraseña. El registro verifica el dominio del email en el servidor y envía un enlace de confirmación; el login está bloqueado (`403`) hasta que la cuenta se confirma. Un enlace **"¿Olvidaste tu contraseña?"** solicita un correo de restablecimiento para el email ingresado (ver [`../backend/auth.md`](../backend/auth.md)). El botón de enviar apunta explícitamente al control de submit del formulario y muestra un estado de carga.

## Inicio — el botón de pánico

Un único botón de mantener-para-alertar. Mantenerlo un par de segundos captura la ubicación GPS del dispositivo y llama a `POST /alerts`, que reparte la alerta a cada canal confirmado de cada contacto.

**Guarda.** Antes de enviar, la app comprueba que al menos un contacto sea alcanzable — cuenta los contactos que estén `confirmed` (email) **o** vinculados a Telegram **o** confirmados en WhatsApp **o** con SMS activado. Si no hay ninguno, muestra un toast en vez de disparar una alerta inútil. El conteo falla-abierto (si el chequeo mismo falla, el botón igual funciona) para que nada bloquee una emergencia real.

## Contactos

Agrega hasta `max_contacts` (servido por `/features`) contactos, a mano o desde la agenda del dispositivo. Cada fila de contacto muestra una tira de estado de canales, y editar un contacto abre un sheet con un toggle por cada canal que el despliegue tenga configurado:

| Canal | Cómo se vuelve alcanzable el contacto |
|---|---|
| **Email** | Confirma con el enlace enviado por correo. Aparece un botón "reenviar confirmación" mientras esté sin confirmar. |
| **Telegram** | "Conectar Telegram" entrega un enlace `t.me` (compartido o por correo); el contacto lo abre y envía `/start`. |
| **WhatsApp** | "Conectar WhatsApp" lo activa y entrega un enlace `wa.me`; el contacto envía el mensaje para hacer opt-in. |
| **SMS** | Un simple toggle de activar/desactivar — sin opt-in. |

Los íconos de canal solo se muestran para los canales que el despliegue tiene habilitados (según `/features`); un punto de estado indica vinculado/activo vs. pendiente.

Cuando se entrega un enlace (un contacto sin email), la app abre el **share sheet nativo del sistema** (`lib/share.js`, `@capacitor/share`), cayendo al portapapeles si un binario instalado más viejo no tiene el plugin.

Editar el email de un contacto vuelve a disparar la confirmación (el contacto queda sin confirmar hasta verificar la nueva dirección). Borrar un contacto conserva el historial de las alertas pasadas en el panel.

## Perfil

Ver y editar la cuenta (nombre, teléfono, email, contraseña). Cambiar el **email o la contraseña** requiere la **contraseña actual** en el mismo formulario (reautenticación); nombre/teléfono no. Se envía un aviso de seguridad a la dirección anterior cuando cambia un campo sensible.

## Sin conexión (offline)

Como la app carga su UI en vivo desde el backend, un dispositivo que no puede alcanzar `API_BASE_URL` vería un WebView en blanco. El `server.errorPath` de Capacitor muestra un `www/offline.html` local en su lugar — una pantalla "estás sin conexión" con la marca y un botón **Retry**. Ver [architecture.md](architecture.md).

## Ajustes

Tema (auto/claro/oscuro), color de acento e idioma. La app trae muchos locales; las cadenas caen a inglés para cualquier clave que falte en un locale.
