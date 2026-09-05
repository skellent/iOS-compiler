# Política de Privacidad — Panic Button

> **Aviso — borrador para revisión legal.** Este documento es un borrador redactado a partir del funcionamiento real de la aplicación. **No constituye asesoría legal.** Antes de publicarlo, debe ser revisado por un profesional del derecho y adaptado a la legislación aplicable (por ejemplo, la de Venezuela, y los reglamentos GDPR/CCPA si la app se ofrece a usuarios de la Unión Europea o California) y a los requisitos de Google Play. Los campos entre corchetes `[ ]` deben completarse.

**Responsable del tratamiento:** [NOMBRE LEGAL DE LA EMPRESA — p. ej. Keylogics]
**Dirección:** [DIRECCIÓN FISCAL]
**Correo de contacto:** [soporte@keylogics.com]
**Aplicación:** Panic Button (`com.keycodelogics.panicbutton`)
**Última actualización:** [FECHA]

---

## 1. Introducción

Panic Button ("la App") es una aplicación de seguridad personal. Al mantener presionado un botón, la App captura la ubicación del usuario y notifica a sus contactos de emergencia por correo electrónico, Telegram, WhatsApp y/o SMS con un enlace a esa ubicación. Esta Política de Privacidad explica qué datos recopilamos, cómo los usamos, con quién los compartimos y qué derechos tienes sobre ellos.

Al crear una cuenta y usar la App, aceptas las prácticas descritas aquí.

## 2. Aviso importante de seguridad

**Panic Button no es un servicio de emergencias ni un sustituto de los cuerpos de seguridad, policía o servicios médicos oficiales.** La App depende de tu conexión a internet, del GPS del dispositivo y de servicios de terceros; la entrega de las alertas **no está garantizada**. En una emergencia real, contacta siempre a los servicios de emergencia oficiales de tu país.

## 3. Qué información recopilamos

Recopilamos únicamente la información necesaria para que la App cumpla su función:

### 3.1. Datos de tu cuenta
- **Nombre**, **número de teléfono** y **correo electrónico** que proporcionas al registrarte.
- **Contraseña**, almacenada siempre de forma **cifrada (hash bcrypt)** — nunca guardamos tu contraseña en texto plano.

### 3.2. Contactos de emergencia
- El **nombre, teléfono y/o correo electrónico** de las personas que tú agregas como contactos de emergencia.
- El estado de vinculación de cada canal (confirmado por correo, vinculado a Telegram/WhatsApp, o habilitado para SMS).

> Al agregar a un contacto de emergencia, declaras que cuentas con su consentimiento para proporcionar sus datos y para que reciba alertas tuyas.

### 3.3. Ubicación
- Tu **ubicación GPS precisa**, capturada **en el momento en que activas una alerta de pánico**. Se envía a tus contactos de emergencia como parte de la alerta y se guarda asociada a esa alerta.
- La App **no** rastrea tu ubicación de forma continua ni en segundo plano en su versión actual. *(Si en el futuro se añade el seguimiento en tiempo real, esta política se actualizará y se solicitará el permiso correspondiente.)*

### 3.4. Datos de uso y técnicos
- **Historial de alertas** (fecha, hora y ubicación de cada alerta) y su **estado de entrega** por contacto y canal.
- **Registros técnicos (logs)** como identificadores de petición, marcas de tiempo y errores, usados para operar y depurar el servicio.

No recopilamos datos de fuentes distintas a las que tú nos proporcionas o generas al usar la App.

## 4. Cómo usamos la información

Usamos tus datos exclusivamente para:

- **Entregar tus alertas de pánico** a tus contactos de emergencia por los canales que hayas configurado.
- **Autenticarte** y mantener tu sesión.
- **Enviarte correos transaccionales**: confirmación de cuenta, confirmación de contactos, restablecimiento de contraseña y avisos de seguridad cuando cambian datos sensibles de tu cuenta.
- **Operar, mantener y mejorar** el servicio y su seguridad.

**No usamos tus datos para publicidad ni los vendemos a terceros.**

## 5. Con quién compartimos la información

### 5.1. Tus contactos de emergencia
Cuando activas una alerta, tus contactos confirmados reciben tu **nombre**, la **fecha y hora**, y un **enlace a tu ubicación**. Esto es el propósito central de la App.

### 5.2. Proveedores de servicio
Para entregar los mensajes usamos proveedores externos que procesan los datos estrictamente necesarios para ese fin:

- **Correo electrónico:** Google (SMTP de Gmail/Workspace).
- **Telegram:** Telegram Messenger.
- **WhatsApp y SMS:** Twilio.
- **Alojamiento e infraestructura:** [PROVEEDOR DE HOSTING].

Estos proveedores tratan los datos conforme a sus propias políticas de privacidad.

### 5.3. Requerimientos legales
Podemos divulgar información si la ley lo exige, o para proteger derechos, seguridad o integridad de las personas.

**No vendemos ni alquilamos tus datos personales.**

## 6. Base del tratamiento y consentimiento

Tratamos tus datos sobre la base de la **ejecución del servicio que solicitas** y de tu **consentimiento**, otorgado al registrarte y configurar tus contactos y canales. Puedes retirar tu consentimiento en cualquier momento eliminando tu cuenta (ver sección 9).

## 7. Conservación de los datos

- Conservamos los datos de tu cuenta y tu historial de alertas mientras tu cuenta esté **activa**.
- Las cuentas registradas que **nunca se confirman** se eliminan automáticamente a las 24 horas.
- Cuando eliminas tu cuenta, borramos tus datos personales asociados [DEFINIR PLAZO, p. ej. "de inmediato" o "en un plazo de X días"], salvo lo que debamos conservar por obligación legal.

## 8. Seguridad

Aplicamos medidas razonables para proteger tu información:

- Las contraseñas se almacenan con **hash bcrypt** (nunca en texto plano).
- La comunicación con nuestro servidor viaja **cifrada por HTTPS/TLS**.
- El acceso a las rutas sensibles requiere autenticación, y ciertos cambios de cuenta exigen re-autenticación con tu contraseña actual.

Ningún sistema es 100 % seguro; no podemos garantizar seguridad absoluta.

## 9. Tus derechos

De acuerdo con la legislación aplicable, tienes derecho a:

- **Acceder** a los datos personales que tenemos sobre ti.
- **Rectificar** datos inexactos (puedes editar tu perfil y contactos en la App).
- **Eliminar** tu cuenta y tus datos personales.
- **Retirar tu consentimiento** en cualquier momento.

Para ejercer estos derechos, edítalos directamente en la App o escríbenos a **[soporte@keylogics.com]**. Responderemos en un plazo razonable conforme a la ley aplicable.

## 10. Eliminación de cuenta y datos

Puedes solicitar la eliminación de tu cuenta [DESCRIBIR EL MÉTODO: opción dentro de la App y/o solicitud por correo a soporte@keylogics.com]. Al hacerlo, se eliminan tu cuenta, tus contactos de emergencia y tus datos personales asociados, salvo lo requerido por ley.

## 11. Transferencias internacionales

Algunos de nuestros proveedores (Google, Telegram, Twilio) operan servidores fuera de tu país de residencia. Al usar la App, entiendes que tus datos pueden procesarse en esas jurisdicciones, sujetos a salvaguardas conforme a la ley aplicable.

## 12. Menores de edad

La App no está dirigida a menores de [EDAD, p. ej. 13/16] años y no recopilamos conscientemente datos de menores de esa edad. Si crees que un menor nos ha proporcionado datos, contáctanos para eliminarlos.

## 13. Cambios a esta política

Podemos actualizar esta Política de Privacidad. Publicaremos la versión vigente con su fecha de "última actualización" y, cuando el cambio sea significativo, lo notificaremos por los medios razonables. El uso continuado de la App tras un cambio implica la aceptación de la política actualizada.

## 14. Contacto

Para cualquier duda sobre esta Política de Privacidad o el tratamiento de tus datos:

**[NOMBRE LEGAL DE LA EMPRESA]**
Correo: **[soporte@keylogics.com]**
Dirección: **[DIRECCIÓN]**
