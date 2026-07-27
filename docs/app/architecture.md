# `app/` — mobile client

## Purpose

`app/` is the Capacitor project that turns the backend (`backend/`, see `docs/backend/`) into an installable Android/iOS app: register, confirm the account by email, log in, hold the panic button to send an alert with the phone's GPS coordinates, and manage the emergency contacts who get notified. It talks to the API over plain HTTP requests (`src/lib/api.js`) — there's no server-rendered page here, the whole UI is a single-page app that ships inside the native shell Capacitor generates.

## Why vanilla HTML/CSS/JS instead of a framework

The whole `src/` directory is plain JavaScript using nothing but DOM APIs (`element.innerHTML`, `addEventListener`, `classList`) — no React, Vue, Svelte, or any templating engine. Every view module (`src/views/*.js`) exports one `render(container, ctx)` function that builds a screen's markup and wires its own event listeners directly, the same shape repeated across every screen rather than a component abstraction layered on top. For an app this size (five screens, no shared complex state beyond "who's logged in"), a framework's bundle size and build complexity buys little; plain DOM manipulation is easy to follow file by file, matching the backend's own preference for the simplest tool that solves the problem at hand (see `docs/backend/main.md`) over infrastructure justified by a future the project isn't at yet.

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

## `API_BASE_URL` and why its default targets the Android emulator specifically

`app/.envexample` ships `API_BASE_URL=http://10.0.2.2:8000`. `10.0.2.2` isn't a typo or a placeholder — it's the fixed address Android's emulator maps to "the host machine's `localhost`" from inside the emulated device's own network namespace; the emulator's own loopback (`127.0.0.1`) refers to the emulator itself, not the development machine running the backend. This only matters for local development against `uv run uvicorn main:app --reload` on the same machine as the emulator: a physical device on the same Wi-Fi needs the machine's actual LAN IP instead, and a deployed backend behind nginx (see root `NGINX.md`) needs its real domain — `app/.env` (gitignored, like the backend's) is where each environment overrides the default.

## Directory layout

```
app/
  build.js              — Bun.build() script, see above
  package.json           — scripts: build, sync, android, ios
  capacitor.config.json  — appId, appName, webDir, splash screen background color
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
      i18n.js                — EN/ES string dictionary + t(key, vars); language persisted via @capacitor/preferences
      theme.js                — derives the full --primary-* CSS scale from one chosen accent hex (HSL math), persisted the same way
      toast.js, sheet.js, dom.js — small shared UI helpers (toast notifications, bottom sheet, escaping/loading-state utilities)
    views/
      login.js, register.js, home.js, contacts.js, profile.js — one render(container, ctx) per screen
  www/
    index.html            — app shell markup (app bar, view container, bottom nav)
    css/styles.css         — the whole design system, see screens.md
    assets/                 — brand-mark.png (auth screens), favicon.png — both cropped/compressed
                            from the same source icon in app/assets/
    js/                    — bundle output (gitignored)
```

## Native platforms: what was scaffolded and what still needs a Mac

`bunx cap add android` and `bunx cap add ios` generated both native projects. Android is fully buildable from a Linux environment (verified with `./gradlew assembleDebug`, see `app/README.md`) since the Android SDK/Gradle toolchain isn't OS-specific. iOS uses Capacitor's Swift Package Manager integration (`ios/App/CapApp-SPM`), so `bunx cap sync ios` completes without needing CocoaPods/Ruby — but actually **building** the iOS app (compiling, running in the Simulator, signing for a device) requires Xcode, which only runs on macOS. That last step has to happen on a Mac; nothing about the web code or the plugin wiring is iOS-specific or blocks it.

Two manifest-level permission declarations were added by hand after scaffolding, since the plugins themselves ship empty native manifests (permissions are declared by the *app*, not by a Capacitor plugin, in both platforms' conventions):

- `android/app/src/main/AndroidManifest.xml`: `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` (panic button) and `READ_CONTACTS`/`WRITE_CONTACTS` (the contacts picker's plugin requests both under one Android permission alias, even though this app never writes to the device's address book).
- `ios/App/App/Info.plist`: `NSLocationWhenInUseUsageDescription` and `NSContactsUsageDescription`, the human-readable strings iOS shows the user the first time each permission is requested.

`android/app/src/main/res/values/colors.xml` was also added by hand: Capacitor's Android template doesn't generate one, so `colorPrimary`/`colorPrimaryDark`/`colorAccent` (which style native chrome — the status bar tint, default widget colors, system dialogs) would otherwise silently fall back to the scaffold's own placeholder blue. This file, `capacitor.config.json`'s splash screen `backgroundColor`, and `www/index.html`'s `theme-color` meta tag are the three places the brand color has to be set independently of `www/css/styles.css`, since each governs a surface the web CSS has no reach into.

## Why the backend needed a CORS change for this app to work at all

See `docs/backend/main.md`'s CORS section: the app's WebView enforces CORS on every `fetch()` it makes to the API, the same as any browser page calling a different origin, since the app's own origin (`capacitor://localhost` on iOS, `https://localhost` on Android) is never the API's origin. `backend/main.py` adds `CORSMiddleware` allowing exactly those two origins (plus `http://localhost` for testing `www/` in a desktop browser) — without it, every request from the app would reach the server and succeed, but the WebView would block the app's own JavaScript from ever seeing the response.

## Relationship with the rest of the project

`app/` is a pure client of `backend/`'s HTTP API (see `backend/API.md`) — it has no direct access to MariaDB, no shared code with the Python backend, and no server-side logic of its own. Its points of contact with the rest of the repository are the URL it's configured to call (`API_BASE_URL`), the CORS origins the backend has to be told to trust, and the `panicswitch://` custom URL scheme the backend's account-confirmation page redirects to (see `docs/backend/credentials.md`'s `app_deep_link`, `docs/backend/pages.md`) — registering the app as that scheme's handler is a native-manifest concern on this side, not something either codebase enforces on the other.
