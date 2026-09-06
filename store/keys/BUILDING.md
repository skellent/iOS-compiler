# Compilar y firmar PanicButton para producción

Esta guía deja el procedimiento reproducible para generar el AAB de Google Play y un APK release.

## Identidad de firma correcta

La identidad de subida de Google Play es:

```text
Alias: panicbutton
SHA-1:   72:A8:66:66:F9:78:30:49:C1:7F:66:E2:A1:38:9E:7D:C2:31:5C:72
SHA-256: 92:84:EA:37:E8:9C:79:52:C0:D9:5E:69:BD:8E:0E:B7:D5:53:36:4B:1B:42:88:AF:14:81:7E:01:62:8C:B7:8C
```

No usar para Play un keystore que muestre la huella `D7:0D:75:...`: es otra identidad.

## Requisitos

- Bun, JDK 21 y Android SDK (`ANDROID_HOME`) instalados.
- Dependencias instaladas: `cd app; bun install`.
- `app/.env` con `API_BASE_URL=https://<dominio-de-produccion>`.

## Restaurar el keystore de Play

Solo hace falta si no existe ya `app/android/app/release-play.keystore` validado. Desde `app/android`:

```powershell
openssl pkcs12 -export `
  -inkey ..\..\store\keys\keycodelogics.pem `
  -in ..\..\store\keys\upload_certificate.pem `
  -name panicbutton `
  -out app\release-play.keystore `
  -passout pass:<CONTRASENA_DEL_KEYSTORE>
```

Comprueba la identidad antes de usarlo:

```powershell
keytool -list -v -keystore app\release-play.keystore -alias panicbutton
```

Debe mostrar la huella SHA-256 anterior.

## Configurar Gradle

Crea `app/android/app/local.properties` (archivo privado, ignorado por Git):

```properties
RELEASE_STORE_FILE=release-play.keystore
RELEASE_STORE_PASSWORD=<CONTRASENA_DEL_KEYSTORE>
RELEASE_KEY_ALIAS=panicbutton
RELEASE_KEY_PASSWORD=<CONTRASENA_DEL_KEYSTORE>
```

`app/android/app/build.gradle` acepta este archivo y aplica la configuración `signingConfig` al tipo `release`.

## Generar la versión

Antes de publicar, incrementa `versionCode` en `app/android/app/build.gradle`; Google Play exige un número superior a cualquier versión ya subida.

Después:

```powershell
cd app
bun run build
bun x cap sync android

cd android
.\gradlew.bat -g .gradle-user-home --no-daemon :app:bundleRelease :app:assembleRelease
```

Resultados:

- AAB: `app/android/app/build/outputs/bundle/release/app-release.aab`
- APK: `app/android/app/build/outputs/apk/release/app-release.apk`

Sube el **AAB** a Play Console. El APK es para distribución directa.

## Verificación final

Desde `app/android`:

```powershell
& "$env:ANDROID_HOME\build-tools\36.0.0\apksigner.bat" verify --verbose --print-certs app\build\outputs\apk\release\app-release.apk
keytool -printcert -jarfile app\build\outputs\bundle\release\app-release.aab
```

Los dos artefactos deben mostrar la huella SHA-256 `92:84:EA:...:62:8C:B7:8C`.

## Nota sobre el APK servido por el backend

`backend/static/downloads/panic-button.apk` era versión `1.0` / `versionCode 1`, mientras la app actual es versión `3.0` / `versionCode 3`; no usarlo como artefacto de release actual. Si se desea ofrecer descarga directa, reemplazarlo solo después de verificar el nuevo APK.
