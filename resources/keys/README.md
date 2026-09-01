# PanicButton — Kit de actualización y firma de la app

Este archivo contiene **todo lo necesario para reconstruir, firmar y actualizar** la app de Android, más el **certificado de subida** para Google Play.

> ⚠️ **GUÁRDALO SEGURO Y PRIVADO.** Quien tenga estos archivos puede producir una actualización que Android acepta como genuina de este desarrollador. Android **solo instala una actualización si está firmada con la misma llave** que la versión ya instalada — perder estos archivos obligaría a que cada usuario desinstale y reinstale desde cero. Ninguno de estos archivos está en git (están en `.gitignore` a propósito).

---

## Contenido del kit

| Archivo | Tipo | Qué es |
|---|---|---|
| `release.keystore` | 🔒 privado | Keystore **PKCS12** que Gradle usa para firmar el release (alias `panicbutton`). Es la llave de firma real. |
| `keycodelogics.pem` | 🔒 privado | La **llave privada RSA** original de la que se derivó la identidad de firma. |
| `upload_certificate.pem` | 🔓 público | El **certificado público** (X.509 en PEM) que se sube a Google Play para el *upload key reset*. Se puede compartir sin riesgo. |
| `local.properties` | 🔒 privado | Va en `app/android/local.properties`. Dice a Gradle dónde está el keystore y sus contraseñas/alias. |
| `app.env` | config | Va en `app/.env`. Fija `API_BASE_URL` al backend de producción. |

### Huella de la llave (referencia)
```
SHA1:   72:A8:66:66:F9:78:30:49:C1:7F:66:E2:A1:38:9E:7D:C2:31:5C:72
SHA256: 92:84:EA:37:E8:9C:79:52:C0:D9:5E:69:BD:8E:0E:B7:D5:53:36:4B:1B:42:88:AF:14:81:7E:01:62:8C:B7:8C
Titular: CN=Panic Button, O=Keylogics, C=US   ·   Válido hasta 2056
```

---

## Herramienta: `keytool`

Todos los comandos usan `keytool`, que viene con el JDK. En esta máquina está en:
```
C:\Users\Skellent\Documents\Software\jdk21\bin\keytool.exe
```
Si no lo tienes en el PATH, usa esa ruta completa en lugar de `keytool`.

---

## 1. Exportar el certificado de subida en el formato que exige Google (PEM)

Google Play **NO** acepta la llave privada ni un certificado en DER (binario). Pide el **certificado público en PEM** (texto Base64 que empieza con `-----BEGIN CERTIFICATE-----`). El flag **`-rfc`** es el que produce ese formato:

```bash
keytool -exportcert -rfc -keystore release.keystore -alias panicbutton -file upload_certificate.pem
```

Verifica que quedó bien antes de subirlo:
```bash
keytool -printcert -file upload_certificate.pem
```
Debe imprimir el certificado y la huella `SHA1: 72:A8:...`. (El `upload_certificate.pem` de este kit ya está generado así.)

### Dónde subirlo en Play Console
**Test and release → App integrity → Play App Signing → Request upload key reset** → elige el motivo, sube `upload_certificate.pem`. Aprobación de Google en ~24-48 h.

---

## 2. Reconstruir y re-firmar el release (AAB / APK)

1. Copia `release.keystore` → `app/android/app/release.keystore`
2. Copia `local.properties` → `app/android/local.properties`
3. Copia `app.env` → `app/.env`
4. En `app/`:
   ```bash
   bun install
   API_BASE_URL='https://devs.panicbutton.me' bun run build
   npx cap sync android
   ```
5. En `app/android/`:
   ```bash
   ./gradlew bundleRelease     # genera el AAB para Google Play
   # o ./gradlew assembleRelease   # genera un APK
   ```
   - AAB: `app/android/app/build/outputs/bundle/release/app-release.aab`
   - APK: `app/android/app/build/outputs/apk/release/app-release.apk`

El artefacto queda firmado con la **misma llave** (`72:A8…`) que las versiones anteriores, así que Google lo acepta como actualización (una vez activo el upload key reset).

---

## 3. (Referencia) Cómo se generó la llave / keystore

Si algún día hay que **regenerar** la identidad de firma desde cero (implica una app nueva a ojos de Android):

```bash
keytool -genkeypair -v \
  -keystore release.keystore -storetype PKCS12 \
  -keyalg RSA -keysize 2048 -validity 10950 \
  -alias panicbutton \
  -dname "CN=Panic Button, O=Keylogics, C=US"
```

Para **importar** una llave privada suelta (`keycodelogics.pem`) + su certificado a un keystore PKCS12 (así se armó el `release.keystore`):
```bash
# 1) generar un certificado desde la llave privada (con openssl)
openssl req -new -x509 -key keycodelogics.pem -out cert.pem -days 10950 \
  -subj "/CN=Panic Button/O=Keylogics/C=US"
# 2) empaquetar llave + cert en un PKCS12
openssl pkcs12 -export -inkey keycodelogics.pem -in cert.pem \
  -name panicbutton -out release.keystore
```

---

## Notas finales

- **Firma siempre con `release.keystore`** (alias `panicbutton`) para no volver a caer en el error *"App Bundle signed with the wrong key"*.
- Mantén **respaldos** de este kit en un lugar seguro (gestor de contraseñas / almacenamiento cifrado).
- El `upload_certificate.pem` es lo único público; el resto es secreto.
- Detalles de despliegue del APK/backend: `docs/en/backend/web-pages.md`.
