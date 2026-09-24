# Configurar Google Drive en Google Cloud y Google Workspace

Manual revisado el 17 de septiembre de 2026 para el flujo actual de Panic Button.

Panic Button usa OAuth 2.0 para crear cada grabación SOS en **Mi unidad** de la cuenta Google que conectó el usuario. Solicita solamente `drive.file`, cifra los tokens en MariaDB y crea un permiso `anyone/reader` para que un contacto pueda abrir el enlace de emergencia sin iniciar sesión en Google.

La aplicación móvil abre la autorización en el navegador del sistema, pero el tipo de cliente OAuth debe ser **Aplicación web**: el backend recibe el callback, protege el Client Secret y cambia el código por tokens. No hacen falta clientes OAuth separados de Android o iOS para este flujo.

## 1. Datos exactos de este proyecto

Para el entorno actual:

```text
Página principal:       https://devs.panicbutton.me/
Política de privacidad: https://devs.panicbutton.me/privacy
Dominio autorizado:     panicbutton.me
URI de redirección:     https://devs.panicbutton.me/integrations/google/callback
Scope:                  https://www.googleapis.com/auth/drive.file
```

La URI de redirección debe coincidir carácter por carácter: HTTPS, sin parámetros y sin `/` final.

## 2. Seleccionar o comprobar el proyecto

1. Entra en [Google Cloud Console](https://console.cloud.google.com/).
2. Abre el selector de proyectos de la barra superior.
3. Selecciona el proyecto de desarrollo creado previamente, por ejemplo `Panic Button Development`.
4. Comprueba el nombre y el ID del proyecto antes de continuar. La selección se conserva entre páginas y es fácil modificar otro proyecto por accidente.
5. Si el proyecto pertenece a una empresa, confirma que aparece bajo la organización correcta.

Para producción conviene crear otro proyecto. Así las credenciales, usuarios de prueba, dominios y revisiones de producción no se mezclan con desarrollo.

No se necesita una cuenta de servicio. Cada usuario debe autorizar su propia cuenta porque los archivos se crean en su Drive.

## 3. Activar Google Drive API

1. Con el proyecto correcto seleccionado, abre **APIs y servicios → Biblioteca**.
2. Busca `Google Drive API`.
3. Abre el resultado cuyo identificador es `drive.googleapis.com`.
4. Pulsa **Habilitar**. Si aparece **Administrar**, ya estaba habilitada.
5. En **APIs y servicios → APIs y servicios habilitados**, confirma que Google Drive API aparece en la lista.

El uso estándar de Drive API no tiene costo adicional y una prueba normal no paga por cada subida. Google anunció que más adelante en 2026 el uso que exceda los umbrales diarios estándar podrá generar cargos si el proyecto habilita facturación para aumentar su cuota. El archivo también consume la cuota de almacenamiento de la cuenta del usuario.

## 4. Elegir la audiencia correcta

Abre **Google Auth Platform → Público objetivo (Audience)**.

Elige **Externo** si Panic Button admitirá cualquiera de estos casos:

- Cuentas personales de Gmail.
- Usuarios de otras empresas.
- Varias organizaciones de Workspace.
- Distribución pública de la aplicación.

Esta es la opción correcta para el producto público.

Elige **Interno** solamente si todos los usuarios pertenecerán a la misma organización de Google Workspace o Cloud Identity propietaria del proyecto. Una aplicación interna rechaza cuentas personales y cuentas de otras organizaciones con `org_internal`.

Para probar una aplicación externa:

1. Mantén el estado de publicación en **Pruebas (Testing)**.
2. En **Usuarios de prueba**, pulsa **Add users**.
3. Agrega la cuenta empresarial que usarás y cualquier otra cuenta de prueba.
4. Guarda los cambios.

Google permite hasta 100 usuarios en Testing. Como este proyecto pide un scope de Drive, la autorización y el refresh token de un usuario de prueba vencen después de siete días. Durante desarrollo será normal volver a conectar Drive.

## 5. Configurar la marca

Abre **Google Auth Platform → Desarrollo de la marca (Branding)** y completa:

```text
Nombre de la aplicación: Panic Button
Correo de asistencia:    una dirección supervisada
Página principal:        https://devs.panicbutton.me/
Política de privacidad:  https://devs.panicbutton.me/privacy
Términos de servicio:    https://devs.panicbutton.me/terms
Dominio autorizado:      panicbutton.me
Contacto del developer:  una dirección supervisada
```

Usa `panicbutton.me` como dominio autorizado, sin `https://` y sin el subdominio `devs`. Debes registrar el dominio antes de agregar URLs que lo utilicen.

La página principal debe ser pública, identificar Panic Button, explicar para qué sirve y enlazar la misma política de privacidad indicada en Google Cloud. La política debe explicar el acceso, uso, almacenamiento, enlaces públicos y eliminación de los datos de Google.

El logo es opcional durante las pruebas. Para una aplicación externa en producción, Google debe verificar la marca para mostrar públicamente el nombre y el logo configurados.

## 6. Verificar el dominio

Este paso es necesario para preparar una aplicación externa para producción y su verificación de marca.

1. Inicia sesión en [Google Search Console](https://search.google.com/search-console) con una cuenta que también sea Owner o Editor del proyecto de Google Cloud.
2. Selecciona **Añadir propiedad**.
3. Elige **Dominio**.
4. Introduce `panicbutton.me`.
5. Copia el registro TXT proporcionado por Google.
6. Agrégalo en el proveedor DNS del dominio.
7. Espera la propagación y pulsa **Verificar**.
8. Regresa a Branding y confirma que `panicbutton.me` permanece en **Authorized domains**.

Verificar solamente `devs.panicbutton.me` como prefijo de URL no sustituye la propiedad de dominio DNS `panicbutton.me`.

## 7. Declarar el acceso mínimo a Drive

1. Abre **Google Auth Platform → Acceso a los datos (Data Access)**.
2. Pulsa **Add or remove scopes**.
3. Busca `Google Drive API` o pega:

```text
https://www.googleapis.com/auth/drive.file
```

4. Selecciona únicamente ese scope.
5. Pulsa **Update** y luego **Save**.
6. Confirma que aparece como scope no sensible.

No agregues `drive`, `drive.readonly` ni scopes de Gmail. `drive.file` permite crear y administrar archivos creados por Panic Button sin leer el Drive completo del usuario. Google lo clasifica como no sensible y su revisión es más sencilla que la de scopes sensibles o restringidos.

## 8. Crear el cliente OAuth del backend

1. Abre **Google Auth Platform → Clientes (Clients)**.
2. Pulsa **Create client**.
3. En **Application type**, elige **Web application**.
4. Usa el nombre `Panic Button Development Backend`.
5. Deja **Authorized JavaScript origins** vacío; este flujo no ejecuta OAuth desde JavaScript del navegador.
6. En **Authorized redirect URIs**, agrega exactamente:

```text
https://devs.panicbutton.me/integrations/google/callback
```

7. Pulsa **Create**.
8. Copia el **Client ID** y el **Client Secret** y guárdalos como secretos. Google puede no volver a mostrar el secreto completo.

No pongas el Client Secret en la app Android, iOS, el bundle JavaScript ni Git.

## 9. Configurar el backend

Edita `backend/.env`:

```dotenv
API_BASE_URL=https://devs.panicbutton.me
GOOGLE_CLIENT_ID=EL_CLIENT_ID
GOOGLE_CLIENT_SECRET=EL_CLIENT_SECRET
GOOGLE_TOKEN_KEY=UNA_CLAVE_FERNET_ESTABLE
VIDEO_RECORD_SECONDS=300
```

Si todavía no existe `GOOGLE_TOKEN_KEY`, genera una sola vez:

```bash
cd backend
uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

No cambies `GOOGLE_TOKEN_KEY` después de conectar usuarios: los tokens cifrados existentes dejarían de poder leerse. Reinicia el backend después de modificar `.env`.

Comprueba la configuración sin imprimir secretos:

```bash
cd backend
uv run python -c "from modules.google_drive import enabled; print({'google_drive_enabled': enabled()})"
```

El resultado esperado es:

```text
{'google_drive_enabled': True}
```

## 10. Autorizar la aplicación en Google Workspace

Este bloque lo realiza un administrador de Workspace con privilegios de seguridad. No es necesario para una cuenta personal de Gmail.

1. Entra en [Google Admin Console](https://admin.google.com/).
2. Abre **Seguridad → Control de acceso y datos → Controles de API**.
3. En **Control de acceso de aplicaciones**, pulsa **Administrar acceso de aplicaciones**.
4. Pulsa **Configurar aplicación nueva**.
5. Elige buscar por **OAuth App Name or Client ID**.
6. Pega el Client ID completo creado en el paso 8.
7. Selecciona el cliente web de Panic Button.
8. Selecciona primero un grupo u unidad organizativa de pruebas.
9. Elige **Datos específicos de Google (Specific Google data)** y permite Google Drive con `drive.file`. También puede usarse **De confianza (Trusted)**, pero concede a esa aplicación una política más amplia y no es la opción mínima.
10. Guarda la configuración.

Los cambios pueden tardar hasta 24 horas, aunque normalmente aparecen antes. La lista de usuarios de prueba de Cloud Console no anula una prohibición establecida por Workspace.

Si Drive está marcado como servicio restringido:

1. Regresa a **Seguridad → Control de acceso y datos → Controles de API**.
2. Abre **Administrar servicios de Google**.
3. Localiza Google Drive.
4. Confirma que el cliente configurado puede usar el scope no considerado de alto riesgo `drive.file` para la unidad o grupo de pruebas.

## 11. Permitir el enlace público de emergencia

Panic Button crea `type=anyone`, `role=reader` y `allowFileDiscovery=false`. Esto equivale a **Cualquier persona que tenga el enlace puede ver**; el archivo no se anuncia para búsqueda, pero cualquiera que obtenga la URL podrá abrirlo y reenviarlo.

El administrador debe comprobar:

1. En Admin Console, abre **Aplicaciones → Google Workspace → Drive y Documentos**.
2. Abre **Configuración para compartir → Opciones para compartir**.
3. Selecciona la unidad organizativa o grupo donde está la cuenta de prueba.
4. En **Compartir fuera de tu organización**, selecciona **Activado**.
5. Marca la opción que permite publicar archivos en la web o hacerlos visibles como archivos públicos o no listados.
6. Guarda o aplica la anulación para esa unidad organizativa.

Si la empresa no permite `Anyone with the link`, el archivo podría subirse pero fallará la creación del enlace para los contactos. Usa una unidad organizativa de prueba, una cuenta Workspace dedicada o una cuenta Gmail personal; no reduzcas la seguridad de toda la organización solo para probar.

## 12. Primera prueba completa

1. Reinicia el backend.
2. Inicia sesión en Panic Button.
3. Abre **Perfil**.
4. Pulsa **Conectar** junto a Google Drive.
5. El navegador del sistema abre Google; elige la cuenta de prueba y acepta `drive.file`.
6. Al ver **Google Drive connected**, vuelve a Panic Button.
7. Pulsa **Actualizar conexiones** y confirma que dice **Conectada**.
8. Activa una alerta SOS de prueba.
9. Autoriza cámara y micrófono.
10. Para esta primera prueba, detén la grabación después de algunos segundos.
11. Espera: la subida a Drive empieza automáticamente al terminar la grabación. No existe un botón manual para compartir.
12. Confirma que la app muestra **Grabación disponible en Google Drive**.
13. Confirma que el archivo aparece en **Mi unidad** de la cuenta conectada.
14. Abre el enlace desde la vista de la alerta.
15. Abre también ese enlace en una ventana privada sin sesión Google.

Si el paso 13 funciona y el 15 falla, OAuth y la subida están correctos; la política de enlace público de Workspace está bloqueando el permiso.

### Pruebas locales

No necesitas publicar la aplicación en Google Play ni App Store para probar Drive. Puedes mantener el proyecto OAuth externo en Testing y agregar tu cuenta en Test users.

- En el navegador del mismo computador puedes usar un callback como `http://localhost:8000/integrations/google/callback`. Debes registrarlo exactamente en el cliente OAuth y usar `API_BASE_URL=http://localhost:8000` durante esa prueba.
- Desde un teléfono físico, `localhost` apunta al teléfono y una dirección LAN HTTP como `http://192.168.x.x` no cumple las reglas de Google para clientes web. Usa `https://devs.panicbutton.me` o un túnel HTTPS cuyo callback esté registrado en Google Cloud.
- El callback siempre llega al backend. La app móvil solamente abre el navegador, graba el video y envía la grabación al backend.

## 13. Pasar de Testing a producción

Para una aplicación externa:

1. Termina página principal, privacidad y términos en el dominio verificado.
2. En **Branding**, ejecuta **Verify Branding** cuando aparezca.
3. Atiende los correos enviados a los contactos del proyecto.
4. Cuando el estado sea **Ready to publish**, pulsa **Publish branding** dentro del plazo que muestre Google.
5. En **Audience**, pulsa **Publish app** para pasar a **In production**.
6. Revisa **Verification Center**.

`drive.file` es no sensible, por lo que no requiere la revisión de scope restringido ni la evaluación de seguridad asociada a `drive`. La aplicación externa todavía debe cumplir la política OAuth y completar la verificación de marca que Google solicite para producción.

Para una aplicación exclusivamente interna de una sola organización, Google normalmente exime la verificación pública de marca, pero siguen aplicando las reglas de API, Drive y enlaces del administrador de Workspace.

## 14. Diagnóstico rápido

| Síntoma | Causa probable | Acción |
|---|---|---|
| Drive aparece como configuración pendiente | Client ID, Client Secret, token key o HTTPS faltante | Revisa `.env`, reinicia y ejecuta la comprobación de `enabled()` |
| `redirect_uri_mismatch` | URI distinta a la registrada | Copia exactamente la URI del paso 1 en el cliente web |
| `access_denied` | El usuario canceló o no está autorizado | Reintenta y comprueba Audience/Test users |
| `org_internal` | Cuenta externa intentando usar una app Internal | Usa una cuenta de la organización o cambia a External |
| `admin_policy_enforced` o app bloqueada | Workspace bloquea el cliente o Drive | Configura el Client ID en API controls |
| Funciona y deja de conectar a los siete días | Proyecto External todavía en Testing | Reconecta durante pruebas o prepara In production |
| El archivo aparece en Drive pero no abre en privado | Workspace bloquea `anyone` | Corrige las opciones para compartir de la unidad de prueba |
| El video queda pendiente en el teléfono | Fallo de red, OAuth o Drive | Corrige la causa y pulsa reintentar; no borres los datos de la app |

## Referencias oficiales

- [Google: configurar la audiencia OAuth](https://support.google.com/cloud/answer/15549945)
- [Google: configurar la marca OAuth](https://support.google.com/cloud/answer/15549049)
- [Google: administrar clientes OAuth](https://support.google.com/cloud/answer/15549257)
- [Google: verificar la marca](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
- [Google Drive: elegir scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google OAuth para aplicaciones web](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Workspace: controlar el acceso de aplicaciones](https://support.google.com/a/answer/7281227)
- [Google Workspace: opciones para compartir Drive](https://support.google.com/a/answer/9178844)
- [Google Drive API: administrar permisos](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
- [Google Drive API: cargas reanudables](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Google Drive API: límites y precios](https://developers.google.com/workspace/drive/api/guides/limits)
