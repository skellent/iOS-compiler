# Política de Privacidad — Panic Button

> **Aviso — borrador para revisión legal.** Este documento es un borrador redactado a partir del funcionamiento real de la aplicación. **No constituye asesoría legal.** Antes de publicarlo, debe ser revisado por un profesional del derecho y adaptado a la legislación aplicable (por ejemplo, la de Venezuela, y los reglamentos GDPR/CCPA si la app se ofrece a usuarios de la Unión Europea o California) y a los requisitos de Google Play. Los campos entre corchetes `[ ]` deben completarse.

**Responsable del tratamiento:** [NOMBRE LEGAL DE LA EMPRESA — p. ej. Keylogics]
**Dirección:** [DIRECCIÓN FISCAL]
**Correo de contacto:** [soporte@keylogics.com]
**Aplicación:** Panic Button (`com.keycodelogics.panicbutton`)
**Última actualización:** 24 de septiembre de 2026

---

## 1. Introducción

Panic Button ("la App") es una aplicación de seguridad personal. Cuando un usuario mantiene presionado el botón SOS, la App captura su ubicación, notifica a sus contactos de emergencia por correo electrónico, Telegram, WhatsApp y/o SMS, y comparte un mapa privado que puede seguir su ubicación en vivo durante un máximo de 60 minutos. Esta Política de Privacidad explica qué datos recopilamos, cómo los usamos, con quién los compartimos y qué derechos tienes sobre ellos.

Al crear una cuenta y usar la App, aceptas las prácticas descritas aquí.

## 2. Aviso importante de seguridad

**Panic Button no es un servicio de emergencias ni un sustituto de los cuerpos de seguridad, policía o servicios médicos oficiales.** La App depende de tu conexión a internet, del GPS del dispositivo y de servicios de terceros; la entrega de las alertas **no está garantizada**. En una emergencia real, contacta siempre a los servicios de emergencia oficiales de tu país.

## 3. Qué información recopilamos

Recopilamos únicamente la información necesaria para que la App cumpla su función:

### 3.1. Datos de tu cuenta
- **Nombre**, **número de teléfono** y **correo electrónico** que proporcionas al registrarte.
- **Contraseña**, almacenada únicamente como **hash bcrypt** — nunca guardamos tu contraseña en texto plano.

### 3.2. Contactos de emergencia
- El **nombre, teléfono y/o correo electrónico** de las personas que tú agregas como contactos de emergencia.
- El estado de vinculación de cada canal (confirmado por correo, vinculado a Telegram/WhatsApp, o habilitado para SMS).

> Al agregar a un contacto de emergencia, declaras que cuentas con su consentimiento para proporcionar sus datos y para que reciba alertas tuyas.

### 3.3. Ubicación
- Tu **ubicación precisa o aproximada**, según el permiso que concedas y las señales disponibles en tu dispositivo, se recopila cuando activas deliberadamente una alerta SOS.
- Después de crear la alerta, la App puede continuar recopilando y transmitiendo actualizaciones para formar una ruta de emergencia en vivo durante un máximo de **60 minutos**, incluso mientras la App está en segundo plano o la pantalla está apagada. Las actualizaciones pueden incluir latitud, longitud, precisión, velocidad, rumbo y las horas de registro y recepción.
- La recopilación en vivo comienza únicamente después de tu acción SOS. Termina cuando seleccionas **Dejar de compartir** o cuando vence la sesión de 60 minutos. La App no usa la ubicación para publicidad ni te rastrea fuera de una sesión de alerta activa.

### 3.4. Video SOS y cuentas vinculadas

Después de una alerta SOS, la App puede pedir acceso a la cámara y al micrófono y grabar hasta cinco minutos de video mientras permanece en primer plano. Si conectaste Google Drive, la App envía automáticamente la grabación terminada a un archivo de tu Drive a través de nuestro servidor. Nuestro servidor retransmite los bytes y no guarda una copia local; solo conserva el estado de la subida, el identificador del archivo de Drive y su enlace. Si una subida falla, la App puede conservar una copia pendiente en tu teléfono para reintentarla. Cualquier persona que tenga el enlace del archivo de Drive podrá verlo; el enlace puede aparecer en la vista de la alerta y un visitante puede reenviarlo.

Conectar Google Drive es opcional y requiere tu consentimiento afirmativo en la pantalla de autorización de Google. Panic Button solicita el alcance `drive.file`, que permite a la App crear y administrar únicamente los archivos de Drive que ella misma crea. Puedes revocar el acceso desconectando Google Drive en la App o desde la configuración de seguridad de tu Cuenta de Google.

### 3.5. Datos de uso y técnicos
- **Historial de alertas**, incluida la fecha, hora, ubicación inicial, ruta en vivo guardada, última ubicación informada y estado de la alerta.
- **Registros de notificaciones**, incluido el contacto/canal utilizado y si se abrió un enlace privado de alerta.
- **Registros técnicos (logs)** como identificadores de petición, marcas de tiempo y errores, usados para operar y depurar el servicio.

No recopilamos datos de fuentes distintas a las que tú nos proporcionas o generas al usar la App.

## 4. Cómo usamos la información

Usamos tus datos exclusivamente para:

- **Entregar tus alertas de pánico** a tus contactos de emergencia por los canales que hayas configurado.
- **Recopilar, guardar y mostrar tu ruta de emergencia en vivo** a ti y a los contactos de emergencia que elegiste mientras una alerta está activa y posteriormente como parte de tu historial.
- **Autenticarte** y mantener tu sesión.
- **Enviarte correos transaccionales**: confirmación de cuenta, confirmación de contactos, restablecimiento de contraseña y avisos de seguridad cuando cambian datos sensibles de tu cuenta.
- **Operar, mantener y mejorar** el servicio y su seguridad.

**No usamos tus datos para publicidad ni los vendemos a terceros.**

Nuestro uso y transferencia de información recibida de las APIs de Google cumple la [Política de Datos de Usuario de los Servicios de API de Google](https://developers.google.com/terms/api-services-user-data-policy), incluidos sus requisitos de Uso Limitado. Los datos de usuario de Google se usan únicamente para ofrecer la función visible de subida a Drive, no se usan para publicidad, no se venden y no se utilizan para entrenar modelos generalizados de inteligencia artificial o aprendizaje automático.

## 5. Con quién compartimos la información

### 5.1. Tus contactos de emergencia
Cuando activas una alerta, tus contactos confirmados reciben, según el canal, tu **nombre**, **número de teléfono**, **correo electrónico**, la **fecha y hora**, las coordenadas informadas inicialmente y un **enlace privado al mapa en vivo**. El mapa puede mostrar tu ruta guardada y tu última ubicación informada. Este intercambio iniciado por el usuario es el propósito central de la App.

### 5.2. Proveedores de servicio
Para entregar los mensajes usamos proveedores externos que procesan los datos estrictamente necesarios para ese fin:

- **Correo electrónico:** Google (SMTP de Gmail/Workspace).
- **Ubicación del dispositivo:** Android y los servicios de Google Play proporcionan a la App la ubicación combinada del dispositivo.
- **Telegram:** Telegram Messenger.
- **WhatsApp y SMS:** Twilio.
- **Visualización del mapa:** el servicio estándar de teselas de OpenStreetMap por defecto, o el proveedor de mapas configurado por el operador. El navegador del visitante solicita las teselas necesarias para el área mostrada, por lo que ese proveedor puede recibir la dirección IP del visitante, información del navegador, el origen de este sitio y las coordenadas de las teselas del área visible.
- **Alojamiento e infraestructura:** [PROVEEDOR DE HOSTING].
- **Google Drive:** recibe automáticamente una grabación SOS después de que conectas Drive y activas una alerta.

Estos proveedores tratan los datos conforme a sus propias políticas de privacidad.

### 5.3. Requerimientos legales
Podemos divulgar información si la ley lo exige, o para proteger derechos, seguridad o integridad de las personas.

**No vendemos ni alquilamos tus datos personales.**

## 6. Base del tratamiento y consentimiento

Tratamos tus datos sobre la base de la **ejecución del servicio que solicitas** y de tu **consentimiento**, otorgado al registrarte, configurar tus contactos y canales, conceder el permiso de ubicación y activar deliberadamente una alerta SOS. Puedes finalizar una sesión activa con **Dejar de compartir**, revocar el permiso de ubicación en los ajustes de Android o retirar tu consentimiento eliminando tu cuenta (ver sección 9).

## 7. Conservación de los datos

- Conservamos los datos de tu cuenta, historial de alertas, puntos de la ruta en vivo y últimas ubicaciones informadas mientras tu cuenta esté **activa**. El servicio actual no elimina automáticamente alertas antiguas de forma individual.
- La recopilación de ubicación en vivo termina después de un máximo de **60 minutos**. El enlace privado de mapa de un contacto vence después de **30 días**; el vencimiento del enlace no elimina por sí solo la alerta ni la ruta guardada del historial de tu cuenta.
- Las cuentas registradas que **nunca se confirman** se eliminan automáticamente a las 24 horas.
- Cuando eliminas tu cuenta, borramos tus datos personales asociados en un plazo máximo de 30 días, salvo lo que debamos conservar por obligación legal.
- Nuestro servidor no conserva archivos locales de los videos SOS. Una subida fallida puede permanecer pendiente en tu teléfono hasta que tenga éxito o se borren los datos locales de la App. Desconectar Google Drive elimina su autorización guardada, pero no borra archivos ya subidos a tu Drive; puedes administrarlos en Google Drive.

## 8. Seguridad

Aplicamos medidas razonables para proteger tu información:

- Las contraseñas se almacenan con **hash bcrypt** (nunca en texto plano).
- La comunicación con nuestro servidor viaja **cifrada por HTTPS/TLS**.
- El acceso a las rutas sensibles requiere autenticación, y ciertos cambios de cuenta exigen re-autenticación con tu contraseña actual.
- Cada notificación a un contacto usa un enlace privado de mapa distinto y aleatorio. Guardamos un hash criptográfico del token de ese enlace, que vence después de 30 días.

Ningún sistema es 100 % seguro; no podemos garantizar seguridad absoluta.

## 9. Tus derechos

De acuerdo con la legislación aplicable, tienes derecho a:

- **Acceder** a los datos personales que tenemos sobre ti.
- **Rectificar** datos inexactos (puedes editar tu perfil y contactos en la App).
- **Eliminar** tu cuenta y tus datos personales.
- **Retirar tu consentimiento** en cualquier momento.

Para ejercer estos derechos, edítalos directamente en la App o escríbenos a **[soporte@keylogics.com]**. Responderemos en un plazo razonable conforme a la ley aplicable.

## 10. Eliminación de cuenta y datos

Puedes solicitar la eliminación de tu cuenta desde la propia App, a través del formulario web de eliminación de cuenta o por correo al contacto indicado en esta política. Al hacerlo, se eliminan tu cuenta, tus contactos de emergencia, tu historial de alertas, los puntos guardados de las rutas en vivo y tus demás datos personales asociados, salvo lo requerido por ley.

## 11. Transferencias internacionales

Algunos de nuestros proveedores (Google, Telegram, Twilio) operan servidores fuera de tu país de residencia. Al usar la App, entiendes que tus datos pueden procesarse en esas jurisdicciones, sujetos a salvaguardas conforme a la ley aplicable.

## 12. Menores de edad

La App no está dirigida a menores de 13 años y no recopilamos conscientemente datos de menores de esa edad. Si crees que un menor nos ha proporcionado datos, contáctanos para eliminarlos.

## 13. Cambios a esta política

Podemos actualizar esta Política de Privacidad. Publicaremos la versión vigente con su fecha de "última actualización" y, cuando el cambio sea significativo, lo notificaremos por los medios razonables. El uso continuado de la App tras un cambio implica la aceptación de la política actualizada.

## 14. Contacto

Para cualquier duda sobre esta Política de Privacidad o el tratamiento de tus datos:

**[NOMBRE LEGAL DE LA EMPRESA]**
Correo: **[soporte@keylogics.com]**
Dirección: **[DIRECCIÓN]**
