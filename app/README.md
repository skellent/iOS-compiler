# PanicButton — Mobile App

A Capacitor app built with vanilla HTML/CSS/TypeScript that consumes the [`backend/`](../backend) API: register, log in, hold the panic button to notify contacts and share GPS updates for 60 minutes, and manage emergency contacts.

**This isn't a self-contained native app** — the WebView navigates straight to the backend's own `/app` route and loads its UI from there live, the same way an Electron window can point at a URL instead of shipping a local copy of the page. `backend/` has to be running and reachable at `API_BASE_URL`, with `www/` already built (step 3 below), for there to be anything to load at all; there's no offline/bundled fallback. The app checks for a new version on launch and whenever it's resumed from the background, and reloads itself automatically when the backend's files have changed — see [`docs/en/app/architecture.md`](../docs/en/app/architecture.md).

## 1. Install dependencies

This project uses [Bun](https://bun.sh/) — both as the package manager and as the bundler that resolves the Capacitor plugins' npm imports into a browser-loadable file (see [`docs/en/app/architecture.md`](../docs/en/app/architecture.md)).

```bash
cd app
bun install
```

## 2. Configure the API URL

```bash
cp .envexample .env
```

Edit `.env` and set `API_BASE_URL` to wherever the backend (`backend/`, see the root README) is reachable from wherever you're running the app:

- **Android emulator**: keep the default, `http://10.0.2.2:8000` — the emulator maps that address to the host machine's own `localhost`, where `uv run uvicorn main:app --reload` is listening.
- **iOS Simulator**: `http://127.0.0.1:8000` (the simulator shares the host's network directly).
- **A physical device** on the same Wi-Fi as the backend: the development machine's LAN IP, e.g. `http://192.168.1.50:8000`.
- **Production**: the real domain behind nginx (see root `NGINX.md`).

This same value now also decides where the app's WebView itself navigates (`capacitor.config.js`'s `server.url`, see [`docs/en/app/architecture.md`](../docs/en/app/architecture.md)), not just where `fetch()` calls go — get it wrong and the app has nothing to load at all, rather than just failing individual requests. `bunx cap sync`/`bun run android`/`bun run ios` (step 4) all read this same `.env`, so it only has to be set once here.

## 3. Build the web assets

```bash
bun run build
```

Bundles `src/main.js` (and everything it imports) into `www/js/main.js`, with `API_BASE_URL` baked in from `.env`. Run this again any time you change anything under `src/` — this is no longer just a step before packaging a native build: `backend/main.py` serves this same `www/` directory directly at `/app` (see [`docs/en/backend/web-pages.md`](../docs/en/backend/web-pages.md)), so the backend has nothing to serve until this has been run at least once, and needs it re-run (and the backend restarted or just left running, since it's served from disk on every request) after any `src/` change to actually reach a device.

## 4. Native platforms

Both platforms were already added to this repository (`android/`, `ios/`) via `bunx cap add android`/`bunx cap add ios`. After building the web assets, sync them into the native projects:

```bash
bun run sync          # bun run build + bunx cap sync (both platforms)
```

### Android

```bash
bun run android        # syncs, then opens the project in Android Studio
```

Requires the Android SDK (`ANDROID_HOME`) and a JDK. To build a debug APK from the command line instead of Android Studio:

```bash
cd android
./gradlew assembleDebug
# output: android/app/build/outputs/apk/debug/app-debug.apk
```

### iOS

```bash
bun run ios            # syncs, then opens the project in Xcode
```

**Requires macOS with Xcode installed** — this is an Apple platform requirement, not specific to this project. The iOS project uses Capacitor's Swift Package Manager integration (`ios/App/CapApp-SPM`), so no CocoaPods/Ruby setup is needed; `bunx cap sync ios` already completes cleanly on Linux, but actually compiling, running in the Simulator, or signing for a real device has to happen on a Mac.

## Permissions

Two features need OS-level permission, requested the first time each is used (no explicit "enable permissions" step in the app itself):

- **Location** (`@capacitor/geolocation` and `@capacitor-community/background-geolocation`) — to attach the initial position and continue sharing while an alert is active.
- **Contacts** (`@capacitor-community/contacts`) — to pick someone from the device's address book as an emergency contact, via the native contact-picker UI (the app never gets bulk access to the address book).

Both are already declared in `android/app/src/main/AndroidManifest.xml` and `ios/App/App/Info.plist` — see [`docs/en/app/architecture.md`](../docs/en/app/architecture.md) for why those had to be added by hand.

## Project layout

See [`docs/en/app/architecture.md`](../docs/en/app/architecture.md) and [`docs/en/app/screens.md`](../docs/en/app/screens.md) (also available in [Spanish](../docs/es/app)).
