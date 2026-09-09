# App real-time tracking compatibility and next steps

The app web bundle implements the complete real-time alert flow, but the native Android
shell determines whether it can continue reliably after the app enters the background.
This document records the current support level and the work required before treating
background tracking as production-ready.

## Current web flow

`app/src/lib/liveTracking.ts` currently:

1. Receives the alert-scoped publisher token from `POST /alerts`.
2. Opens the publisher WebSocket and authenticates it.
3. Starts `@capacitor-community/background-geolocation` with a persistent-notification
   title and message.
4. Publishes numbered coordinates and keeps the newest unsent point for reconnect.
5. Sends a heartbeat every 25 seconds and reconnects with bounded exponential backoff.
6. Persists the alert id, publisher token, expiry, sequence, and watcher id using
   `@capacitor/preferences`.
7. Restores a live session after WebView reload and removes the native watcher when the
   user stops sharing or the server ends the session.
8. Falls back to `@capacitor/geolocation` when native background tracking is unavailable.
   This fallback requires the app to remain open.

The expected support level is:

| Device state | Current expectation |
|---|---|
| App open in foreground | Supported by the current web flow. |
| App briefly backgrounded | Expected after the required native plugins are synchronized and verified. |
| App backgrounded or screen-locked for an extended period | Not guaranteed because publishing still uses a WebView WebSocket. |
| App force-closed | Do not expect tracking or publishing to continue. |
| Browser without Capacitor | Foreground-only fallback through the browser Geolocation API. |

## Installed app versus remotely served web code

The Capacitor shell loads `/app/` from the configured backend. Updated JavaScript and
CSS can therefore reach an installed app when it reloads the remote page. Capacitor
plugins, Android services, permissions, and configuration are compiled into the APK;
serving new JavaScript cannot add them to an older installed binary.

Before relying on an already-installed build, confirm that its APK contains:

- `@capacitor-community/background-geolocation`
- `@capacitor/local-notifications`
- `@capacitor/geolocation`
- `@capacitor/preferences`
- `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION`
- `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_LOCATION`
- `POST_NOTIFICATIONS` on Android 13 and newer
- `android.useLegacyBridge: true` in the Capacitor configuration

## Repository state recorded on September 8, 2026

The TypeScript dependencies declare all four required plugins. The generated Android
project includes Background Geolocation, Geolocation, and Preferences, but Local
Notifications is absent from `android/capacitor.settings.gradle` and
`android/app/capacitor.build.gradle`. This means the dependency was installed after the
last native Capacitor synchronization.

In that native state, `LocalNotifications.checkPermissions()` can fail before the
background watcher is added. The surrounding fallback then starts ordinary foreground
geolocation. Before producing the next APK, run the dependency install and Capacitor
sync/update workflow, inspect the generated plugin lists, and build a new native binary.
An APK already installed on another device must be rebuilt unless it already contains
Local Notifications.

## Capacitor 8 compatibility risk

The project currently declares Capacitor 8.4.x and
`@capacitor-community/background-geolocation` 1.2.26. That plugin's compatibility table
and changelog explicitly list support through Capacitor 7. Its broad peer dependency
allows installation with newer Capacitor versions, but an open upstream issue still
requests Capacitor 8 support.

Before the next native release:

1. Check the plugin's current releases and Capacitor 8 issue.
2. Prefer an upstream release that explicitly supports Capacitor 8.
3. If no supported release exists, evaluate a maintained alternative or a small
   app-owned native location service.
4. Verify Gradle compilation and runtime behavior on the actual Android versions the
   app supports.

References:

- [Background Geolocation repository and installation table](https://github.com/capacitor-community/background-geolocation)
- [Background Geolocation issue tracker](https://github.com/capacitor-community/background-geolocation/issues)
- [Capacitor Local Notifications documentation](https://capacitorjs.com/docs/apis/local-notifications)

## WebView network limitation

The native Background Geolocation plugin can keep producing locations through an
Android foreground service. The current code passes each callback back into JavaScript
and sends it through a WebSocket owned by the WebView. These are separate concerns:
native location collection can remain alive while Android suspends or throttles WebView
network work.

The plugin documentation warns that Android can throttle network requests initiated by
the WebView after about five minutes in the background. Its documented example uses
HTTP, while this project uses a WebSocket; the WebSocket still belongs to the WebView
and should not be treated as a guaranteed long-running background transport.
`android.useLegacyBridge: true` protects delivery of native callbacks but does not turn
the JavaScript WebSocket into a native connection.

## Recommended production implementation

Keep the existing WebSocket protocol for foreground use and contact map viewers. Move
background publishing into a native Android component:

1. Let the native foreground location service receive positions.
2. Give it the alert id, publisher credential, API origin, expiry, and last acknowledged
   sequence when tracking starts.
3. Publish from native code using either a native WebSocket client or a native HTTP
   location endpoint. If HTTP is chosen, add an authenticated backend endpoint that
   applies the same sequence validation, persistence, and viewer broadcast behavior as
   the publisher WebSocket.
4. Store a small durable queue of unsent positions and retry with bounded backoff when
   connectivity returns.
5. Stop the service on explicit stop, token expiry, invalid authentication, or server
   terminal status.
6. Report native connection state to the WebView whenever the UI is active.
7. Keep the visible Android foreground-service notification for the entire tracking
   session.

Avoid storing an account session token in the native service. Use only the alert-scoped,
short-lived publisher credential so a leaked tracking credential cannot access the
user's account.

## Required physical-device verification

Run device checks only after the repository owner authorizes testing. Use a release-like
APK and verify:

1. Foreground tracking for the full session.
2. More than five minutes with the app backgrounded.
3. More than five minutes with the screen locked.
4. Temporary loss and restoration of Wi-Fi/mobile data.
5. Process recreation and reopening the app during an active session.
6. Notification permission granted and denied on Android 13+.
7. Location permission granted, approximate-only, and denied.
8. Battery optimization behavior on at least one stock Android device and one
   manufacturer-modified Android device.
9. Explicit stop, server expiry, and authentication rejection.
10. Viewer movement, reconnect, and final ended state throughout these scenarios.

Record the Android version, device model, app build, plugin versions, duration, and last
acknowledged sequence for every physical-device run.
