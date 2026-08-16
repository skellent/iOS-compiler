# `app/` — mobile client

## Purpose

`app/` is the Capacitor project that turns the backend (`backend/`, see `docs/backend/`) into an installable Android/iOS app: register, confirm the account by email, log in, hold the panic button to send an alert with the phone's GPS coordinates, and manage the emergency contacts who get notified. It talks to the API over plain HTTP requests (`src/lib/api.js`) — the whole UI is a single-page app, built the same `src/` → `www/` way as before, but it no longer ships inside the native binary Capacitor generates. The WebView instead navigates straight to that same `www/` content served live by the backend (see "Why the app loads its UI from the backend instead of bundling it" below) — the native shell is a thin wrapper around a URL, the same idea as an Electron window pointed at a link.

## Why vanilla HTML/CSS/JS instead of a framework

The whole `src/` directory is plain JavaScript using nothing but DOM APIs (`element.innerHTML`, `addEventListener`, `classList`) — no React, Vue, Svelte, or any templating engine. Every view module (`src/views/*.js`) exports one `render(container, ctx)` function that builds a screen's markup and wires its own event listeners directly, the same shape repeated across every screen rather than a component abstraction layered on top. For an app this size (seven screens, no shared complex state beyond "who's logged in"), a framework's bundle size and build complexity buys little; plain DOM manipulation is easy to follow file by file, matching the backend's own preference for the simplest tool that solves the problem at hand (see `docs/backend/main.md`) over infrastructure justified by a future the project isn't at yet.

## Why Bun as a bundler, and what `import.meta.env.API_BASE_URL` actually is

Capacitor plugins (`@capacitor/geolocation`, `@capacitor/preferences`, `@capacitor-community/contacts`) are npm packages consumed via `import { X } from "@capacitor/geolocation"` — a bare specifier a browser can't resolve on its own (there's no `node_modules` lookup in a WebView). Something has to turn that into a single file the WebView can load. Rather than adding a dedicated bundler dependency (esbuild, Vite, Rollup), `build.js` uses Bun's own built-in bundler (`Bun.build()`), since the project already depends on `bun` to install and manage `app/`'s packages (see `package.json`) — no new tool, no new config file format, just a script:

```js
const apiBaseUrl = process.env.API_BASE_URL || "http://10.0.2.2:8000";

const result = await Bun.build({
  entrypoints: ["src/main.js"],
  outdir: "www/js",
  target: "browser",
  format: "esm",
  define: {
    "import.meta.env.API_BASE_URL": JSON.stringify(apiBaseUrl),
  },
});
```

This is the only place a "build step" exists in this project — it isn't compiling TypeScript (there's none: every `.js` file is already valid, directly runnable JavaScript) or transforming syntax, it's exclusively resolving npm imports into one file the WebView can load as `<script type="module" src="js/main.js">` (`www/index.html`).

`define` is what makes `src/lib/api.js`'s `const BASE_URL = import.meta.env.API_BASE_URL;` work: at build time, Bun textually replaces that exact expression with whatever `API_BASE_URL` resolves to (from `app/.env`, which `bun build.js` loads automatically the same way `uv run` loads `backend/.env`), baked into the shipped JavaScript as a plain string literal. There's no `import.meta.env` object at runtime; the WebView never sees the expression at all, only the literal URL substituted in its place. This is the same build-time environment variable pattern bundlers like Vite popularize, reused here without adding Vite itself.

## Why `www/js/` isn't committed

`app/.gitignore` excludes `www/js/` (the bundle `build.js` produces) and `node_modules/`, the same way `backend/.gitignore` excludes `.venv/` — both are regenerable from source plus a lockfile, and committing generated output would just be a second copy of the same information that inevitably drifts out of sync with `src/`. Anyone picking up `app/` runs `bun install` then `bun run build` (see `app/README.md`) before the native project has real web assets to package, the same two-step shape as the backend's `uv sync` then `uv run`.

## Why the app loads its UI from the backend instead of bundling it

Every previous version of this app used Capacitor the conventional way: `capacitor.config.json` set `webDir: "www"`, `bunx cap sync` copied `www/` into the native project, and the WebView loaded that local copy — an install had the entire UI baked in from the moment it was downloaded, and the only way to change so much as a CSS color was to ship a new build to every device.

That's no longer how it works. `backend/main.py` now serves `app/www` itself, at `/app` (see `docs/backend/main.md`'s `/app` section), and `capacitor.config.js`'s `server.url` points the WebView straight at `${API_BASE_URL}/app/` instead of relying on `webDir`. Concretely:

```js
server: {
  url: `${apiBaseUrl}/app/`,
  cleartext: true,
},
```

The WebView's own origin becomes wherever the backend is reachable (the same `API_BASE_URL` `src/lib/api.js` already used) instead of Capacitor's fixed `capacitor://localhost`/`https://localhost` origins — the app is, at that point, doing exactly what Electron's `BrowserWindow.loadURL()` does: pointing a native window at a URL and letting it render whatever's there. `webDir`/`www/` and `build.js` didn't go away — `bun run build` still bundles `src/` into `www/js/main.js` the same way it always did (see above) — the only thing that changed is *who serves that output*: the backend, live, instead of the native binary shipping a frozen copy of it. `cleartext: true` exists because a *main-frame navigation* over plain `http://` (the dev `API_BASE_URL` values, `http://10.0.2.2:8000` etc.) is blocked by Android by default, a stricter check than the one that already applied to the app's own `fetch()` calls to the API before this change.

One consequence worth calling out: there's no bundled fallback. A device with no network reachable to `API_BASE_URL` has nothing to load at all, not even a broken cached version — a deliberate tradeoff in exchange for never needing to ship a new native build just to fix a typo in a screen's copy.

## Why `capacitor.config.js` instead of `capacitor.config.json`

`server.url` has to be built from `API_BASE_URL`, the same environment-specific value `build.js` already reads from `app/.env` (emulator vs. physical device vs. production, see `API_BASE_URL` below) — a static `.json` file can't express "whatever `.env` currently says." Capacitor's config loader accepts a `.ts`/`.js` file in place of `.json` for exactly this reason. `capacitor.config.js` is plain CommonJS (`require`/`module.exports`), not the ESM `src/` code runs as, because it's loaded by the `@capacitor/cli` Node process directly, not bundled by Bun — and unlike `build.js` (run via `bun build.js`, where Bun's own automatic `.env` loading applies), the Capacitor CLI runs under plain Node, so this file calls `require("dotenv").config()` itself first. `dotenv` was added as a dev dependency solely for this one line.

## Keeping the app in sync when the backend's files change

A WebView that's already loaded a page keeps running it — a new deploy on the backend doesn't reach a phone that's just sitting in the background, the same way pushing to a live website doesn't refresh a browser tab someone already has open. `src/lib/appUpdate.js` closes that gap:

```js
async function checkForUpdate() {
  const latest = await fetchManifestVersion();       // GET /app/manifest
  const { value: known } = await Preferences.get({ key: VERSION_KEY });
  if (known === null) { /* first run: just remember it */ }
  else if (known !== latest) { /* reload */ }
}

export function initAppUpdates() {
  checkForUpdate();
  App.addListener("resume", checkForUpdate);
}
```

`main.js`'s `boot()` calls `initAppUpdates()` before anything else. `GET /app/manifest` (see `docs/backend/main.md`, `backend/modules/app_assets.py`) returns a content hash of everything under `app/www` computed fresh on every request — not a version number anyone has to remember to bump. The known hash is persisted with `@capacitor/preferences`, the same plugin `session.js` already uses for the auth token; when it doesn't match what the backend just reported, the app calls `window.location.reload()`. Because `main.py` serves every file under `/app` (including `index.html`) with `Cache-Control: no-cache`, that reload always revalidates against the server instead of the WebView quietly serving the same stale files back out of its own disk cache — the check-and-compare logic here is what decides *when* to reload, and the response header is what guarantees the reload actually fetches something new.

The check runs on boot and on `@capacitor/app`'s `resume` event (foregrounding the app after it was backgrounded) rather than on a timer — this app has no long-running foreground session where a periodic poll would add value beyond those two moments, and both are already points where a hard reload is unsurprising to the user (a cold start, or an app that was just off-screen).

## `API_BASE_URL` and why its default targets the Android emulator specifically

`app/.envexample` ships `API_BASE_URL=http://10.0.2.2:8000`. `10.0.2.2` isn't a typo or a placeholder — it's the fixed address Android's emulator maps to "the host machine's `localhost`" from inside the emulated device's own network namespace; the emulator's own loopback (`127.0.0.1`) refers to the emulator itself, not the development machine running the backend. This only matters for local development against `uv run uvicorn main:app --reload` on the same machine as the emulator: a physical device on the same Wi-Fi needs the machine's actual LAN IP instead, and a deployed backend behind nginx (see root `NGINX.md`) needs its real domain — `app/.env` (gitignored, like the backend's) is where each environment overrides the default.

## Directory layout

```
app/
  build.js              — Bun.build() script, see above
  package.json           — scripts: build, sync, android, ios
  capacitor.config.js    — appId, appName, webDir, server.url (built from API_BASE_URL), splash screen background color
  .envexample             — API_BASE_URL template
  assets/                 — source app icon/splash artwork, fed to `bunx capacitor-assets` to
                            generate every platform-specific size under android/ and ios/
  android/, ios/          — native projects generated by `bunx cap add <platform>`; not hand-edited
                            except for the permission declarations and colors.xml noted below
  src/
    main.js               — composition root: hash router, app-bar/bottom-nav chrome, session boot
    lib/
      api.js               — fetch wrapper for every backend endpoint (see api.md)
      session.js           — token persistence (@capacitor/preferences) + in-memory cached user
      geolocation.js        — thin wrapper around @capacitor/geolocation for the panic button
      contactsPicker.js     — thin wrapper around @capacitor-community/contacts' native picker
      icons.js               — inline Material-style SVG icon set, see screens.md
      i18n.js                — 12-language string dictionary + t(key, vars); language persisted via @capacitor/preferences
      theme.js                — derives the full --primary-* CSS scale from one chosen accent hex (HSL math), persisted the same way
      phone.js                — country-code list + split/combine helpers for the phone number fields
      features.js              — caches GET /features so screens can ask "is Telegram on" without a request each
      appUpdate.js              — checks GET /app/manifest on boot/resume, reloads the WebView when the backend's files changed
      toast.js, sheet.js, dom.js — small shared UI helpers (toast notifications, bottom sheet, escaping/loading-state utilities)
    views/
      login.js, register.js, home.js, contacts.js, profile.js — one render(container, ctx) per screen
      about.js, help.js     — static informational screens, reached only from buttons on Profile
  www/
    index.html            — app shell markup (app bar, view container, bottom nav)
    css/styles.css         — the whole design system, see screens.md
    assets/                 — brand-mark.png (auth screens), favicon.png — both cropped/compressed
                            from the same source icon in app/assets/
    js/                    — bundle output (gitignored)
```

`www/` is no longer copied into the native binary by `cap sync` in any way that matters at runtime — it's built here the same way as always, but what actually reaches a phone is this same directory served live by `backend/main.py`'s `/app` mount (see "Why the app loads its UI from the backend instead of bundling it" above). A production deploy has to run `bun run build` in `app/` before (or as part of) starting the backend, the same way it already needs `uv sync` for the Python side.

## Native platforms: what was scaffolded and what still needs a Mac

`bunx cap add android` and `bunx cap add ios` generated both native projects. Android is fully buildable from a Linux environment (verified with `./gradlew assembleDebug`, see `app/README.md`) since the Android SDK/Gradle toolchain isn't OS-specific. iOS uses Capacitor's Swift Package Manager integration (`ios/App/CapApp-SPM`), so `bunx cap sync ios` completes without needing CocoaPods/Ruby — but actually **building** the iOS app (compiling, running in the Simulator, signing for a device) requires Xcode, which only runs on macOS. That last step has to happen on a Mac; nothing about the web code or the plugin wiring is iOS-specific or blocks it.

Two manifest-level permission declarations were added by hand after scaffolding, since the plugins themselves ship empty native manifests (permissions are declared by the *app*, not by a Capacitor plugin, in both platforms' conventions):

- `android/app/src/main/AndroidManifest.xml`: `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` (panic button) and `READ_CONTACTS`/`WRITE_CONTACTS` (the contacts picker's plugin requests both under one Android permission alias, even though this app never writes to the device's address book).
- `ios/App/App/Info.plist`: `NSLocationWhenInUseUsageDescription` and `NSContactsUsageDescription`, the human-readable strings iOS shows the user the first time each permission is requested.

A third attribute was added by hand for the same reason once the app started loading from `server.url` (see above): `AndroidManifest.xml`'s `<application>` tag needs `android:usesCleartextTraffic="true"`. **This only matters for local development.** The production `API_BASE_URL` is a real `https://` domain (see root `NGINX.md`), and this flag doesn't force cleartext or weaken anything about that connection — it only *permits* plain `http://` if the app ever tries it, which a production build configured with an `https://` `API_BASE_URL` simply never does. It exists purely because local development's `API_BASE_URL` values (`http://10.0.2.2:8000`, a LAN IP, etc., see below) are cleartext: `capacitor.config.js`'s `server.cleartext: true` reads as though it should cover this on its own, but it only affects Capacitor's own runtime WebView setup — it isn't written into the manifest by `cap sync` for a project that already has one (as opposed to one being scaffolded fresh). Without this attribute, the WebView's main-frame navigation to an `http://` `server.url` is blocked outright by Android's default cleartext policy (API 28+), and the app shows nothing at all — no page, no browser-style error, just blank (confirmed while testing this feature on a physical device).

`android/app/src/main/res/values/colors.xml` was also added by hand: Capacitor's Android template doesn't generate one, so `colorPrimary`/`colorPrimaryDark`/`colorAccent` (which style native chrome — the status bar tint, default widget colors, system dialogs) would otherwise silently fall back to the scaffold's own placeholder blue. This file, `capacitor.config.js`'s splash screen `backgroundColor`, and `www/index.html`'s `theme-color` meta tag are the three places the brand color has to be set independently of `www/css/styles.css`, since each governs a surface the web CSS has no reach into.

## `SplashScreen.hide()`: required because `launchAutoHide` is `false`

`capacitor.config.js` sets `SplashScreen.launchAutoHide: false` — the native splash overlay stays on screen indefinitely until something explicitly calls `SplashScreen.hide()`, rather than dismissing itself once the WebView's first frame is ready. `main.js`'s `boot()` does that as its last step, after `renderCurrentRoute()` has put the first screen's markup in place:

```js
await renderCurrentRoute();
await SplashScreen.hide();
```

Hiding it *after* the first render, not before, matters here specifically because loading is no longer instantaneous the way a locally-bundled `www/` was: the WebView now has to actually fetch `index.html`/`css`/`js` (and this module's own `await`s — language, theme, session — run before the first paint), so hiding the splash any earlier would flash an incomplete or blank page for whatever's left of that loading time.

## CORS: mostly historical now that the app is served from the backend's own origin

See `docs/backend/main.md`'s CORS section: `backend/main.py`'s `CORSMiddleware` still allows `capacitor://localhost`, `https://localhost` and `http://localhost` — Capacitor's fixed WebView origins from when the app loaded a locally-bundled `www/`. Now that `server.url` (see above) navigates the WebView to the backend's own origin (`API_BASE_URL`), every `fetch()` `src/lib/api.js` makes to that same origin is same-origin, not cross-origin, so CORS no longer actually gates anything for a normal install. The allowed origins were left in place rather than removed: they cost nothing to keep, and they're still what a browser reports if anyone ever points a desktop browser tab directly at `/app/` instead of going through the WebView.

## Relationship with the rest of the project

`app/` is a client of `backend/`'s HTTP API (see `backend/API.md`) — it has no direct access to MariaDB and no server-side logic of its own, but it's no longer independent of the backend the way a plain API client would be: the backend now serves the app's own UI (`/app`, see `docs/backend/main.md`), so a backend that's down means there's no app to open, not just no data to fetch. Its points of contact with the rest of the repository are the URL it's configured to call and load from (`API_BASE_URL`), `GET /app/manifest` (`appUpdate.js`, see above), and `GET /features` (see `docs/backend/routers.md`, `docs/backend/features.md`), which `lib/features.js` reads once to decide whether the Contacts screen's Telegram-linking UI should render at all — a deployment with no Telegram bot configured hides that UI entirely instead of offering a button that would just fail. There's no custom URL scheme linking the two sides anymore: the account-confirmation email used to redirect into a `panicswitch://` deep link the app never actually registered a handler for, and both that redirect and the app-side registration it would have needed were dropped rather than finished (see `docs/backend/pages.md`) — a newly confirmed account is simply told to open the app and log in manually.
