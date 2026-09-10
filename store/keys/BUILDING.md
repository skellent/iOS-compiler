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

- Bun y JDK 25.
- Android SDK Platform 36.1, Build-Tools 36.0.0 y Platform-Tools.
- `ANDROID_HOME` apuntando al SDK.
- Dependencias instaladas con `cd app; bun install`.
- `app/.env` con el `API_BASE_URL` de producción.

## Preparar la firma

Copia `store/keys/release-play.keystore` a `app/android/app/release-play.keystore`.
Ambos archivos `.keystore` quedan ignorados por Git.

Crea `app/android/app/local.properties`:

```properties
RELEASE_STORE_FILE=release-play.keystore
RELEASE_KEY_ALIAS=panicbutton
```

Proporciona las contraseñas solo en la terminal que hará la compilación:

```fish
set -gx PANICBUTTON_RELEASE_STORE_PASSWORD '<CONTRASENA_DEL_KEYSTORE>'
set -gx PANICBUTTON_RELEASE_KEY_PASSWORD '<CONTRASENA_DE_LA_CLAVE>'
```

También se aceptan `RELEASE_STORE_PASSWORD` y `RELEASE_KEY_PASSWORD` dentro del
`local.properties` privado. Gradle detiene cualquier tarea release si falta alguna
contraseña, evitando producir un artefacto sin la firma esperada.

## Generar la versión

Antes de publicar, incrementa `versionCode` en `app/android/app/build.gradle`.
Google Play exige un número superior a cualquier versión ya subida.

```fish
cd app
bun run build
bunx cap sync android

cd android
./gradlew --no-daemon :app:bundleRelease :app:assembleRelease
```

Resultados:

- AAB: `app/android/app/build/outputs/bundle/release/app-release.aab`
- APK: `app/android/app/build/outputs/apk/release/app-release.apk`

Sube el AAB a Play Console. El APK es para distribución directa.

## Verificar la firma

Desde `app/android`:

```fish
$ANDROID_HOME/build-tools/36.0.0/apksigner verify --verbose --print-certs app/build/outputs/apk/release/app-release.apk
keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab
```

Los dos artefactos deben mostrar la huella SHA-256 documentada arriba.

## APK servido por el backend

`backend/static/downloads/panic-button.apk` es un artefacto anterior. Reemplázalo
solo después de verificar la versión y la firma del nuevo APK release.
