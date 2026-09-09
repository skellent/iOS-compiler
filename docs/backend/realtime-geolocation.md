# Real-time geolocation implementation guide

This document is the implementation checklist for replacing the fixed Google Maps
redirect with a live, token-protected map. Keep it updated when the protocol or
tracking lifecycle changes.

## Implementation status

- [x] Database schema and upgrade migration
- [x] Alert-scoped publisher tokens and API response
- [x] Publisher and viewer WebSocket endpoints
- [x] Embedded live map and connection states
- [x] Android background watcher, reconnect, restore, and stop flow
- [x] Notification copy and operational documentation
- [x] Install dependencies needed for static checks and generate the app bundle
- [x] Run TypeScript type checking, Python compilation, and focused token/model checks
- [ ] Run database, WebSocket integration, browser, and physical Android checks

## Product decisions

- Android is the supported native platform in this repository.
- A tracking session starts when `POST /alerts` succeeds.
- Tracking ends when the user taps **Stop sharing** or 60 minutes after the alert.
- Contacts use the existing per-notification signed URL. Opening it still records
  `viewed_at`, but now renders a live page instead of redirecting to Google Maps.
- The live page uses Leaflet with a configurable tile URL and attribution. The
  defaults use the standard OpenStreetMap raster tiles for initial deployments.
- The initial alert coordinate remains available after live tracking ends.

## Protocol

1. The app gets an initial high-accuracy GPS position and calls `POST /alerts`.
2. The backend creates the alert, its initial location point, and notification rows.
3. The response contains the alert id, expiry time, and a short-lived publisher JWT.
4. The app opens `/alerts/{alert_id}/track`, sends an `auth` message first, and then
   sends `location`, `ping`, or `stop` messages.
5. The server validates and persists each position and broadcasts it to viewers of
   that alert.
6. A contact opens `/alerts/view/{notification-token}`. The server marks only that
   notification as viewed and renders the map.
7. The page opens `/alerts/view/{notification-token}/live`. Its first message is a
   persisted snapshot, so refresh and reconnect do not lose the current position.

Publisher messages:

```json
{"type":"auth","token":"<publisher JWT>"}
{"type":"location","sequence":1,"latitude":10.49,"longitude":-66.87,"accuracy":12.4,"speed":2.1,"bearing":84,"recorded_at":"2026-09-08T18:32:15Z"}
{"type":"ping"}
{"type":"stop"}
```

Server messages use `snapshot`, `location`, `ack`, `status`, `pong`, and `error`
types. Close codes distinguish invalid credentials, expired sessions, and malformed
messages.

## Persistence

- Extend `alerts` with status, tracking expiry/end time, and latest-location fields.
- Add `alert_locations`, keyed by `(alert_id, sequence)`, for reconnect recovery and
  the route trail.
- Update both the fresh-install schema and an ordered migration for existing data.
- Keep database work outside the async WebSocket event loop by using FastAPI's
  thread pool around the current synchronous MariaDB cursor.

## Backend

- Add alert-scoped publisher JWT creation and validation.
- Return the publisher JWT and expiry from `POST /alerts`.
- Add a connection manager grouped by alert id. It is intentionally process-local;
  deployments with multiple Uvicorn workers must replace it with Redis pub/sub.
- Add publisher and viewer WebSocket endpoints.
- Replace the redirect response with a live-map Jinja template.
- Keep per-channel notification creation and delivery unchanged.
- Add configurable `MAP_TILE_URL` and `MAP_TILE_ATTRIBUTION` settings.
- Add `websockets` to backend dependencies for Uvicorn's WebSocket protocol.

## Contact map

- Render the latest point, an accuracy circle, and the persisted trail.
- Show live, reconnecting, stale, ended, and expired states.
- Follow the marker until the viewer manually pans; provide a recenter control.
- Host app-specific JavaScript and CSS locally. Leaflet is pinned with subresource
  integrity when loaded from its CDN.
- Use `Cache-Control: no-store`, `noindex`, and a referrer policy that sends only the
  site origin to the configured tile host, never the signed URL path.

## Android app

The web flow below is implemented. Its current native compatibility and the remaining
work for reliable extended background publishing are documented in
[`../app/realtime-tracking.md`](../app/realtime-tracking.md).

- Start `@capacitor-community/background-geolocation` only after the alert exists.
- Use a foreground-service notification while sharing.
- Open the publisher WebSocket, authenticate, send numbered positions, and reconnect
  with bounded exponential backoff.
- Keep the latest unsent position and send it after reconnecting.
- Show an active-tracking panel with connection state, elapsed time, and a stop
  button. Do not reset the home screen to idle while tracking remains active.
- Stop and remove the native watcher when the user stops, the server expires the
  session, or authentication becomes invalid.
- Request Android 13+ notification permission through Capacitor Local Notifications
  before starting the background foreground-service notification.
- Count WhatsApp-confirmed and SMS-enabled contacts in the existing alert guard.

## Deployment

- Apply the real-time migration before deploying the backend.
- Ensure the reverse proxy forwards WebSocket upgrade headers and has an idle timeout
  longer than the 25-second heartbeat.
- Set the public API URL to HTTPS so the app and page derive `wss://` URLs.
- Configure map tiles if the defaults are unsuitable for production traffic.
- Use one Uvicorn worker until a shared pub/sub backend is introduced.

## Verification checklist

Run these only after the repository owner authorizes testing:

1. [completed] Static Python compilation and TypeScript build.
2. [completed] Focused token/model tests without external notification delivery.
3. Database migration against the configured development MariaDB instance.
4. Backend integration test with one publisher and two viewer sockets.
5. Browser check of initial snapshot, movement, reconnect, and ended state.
6. Physical Android check while foregrounded, backgrounded, and screen-locked.
7. Confirm notification links still record their own `viewed_at` values.

The repository includes a ten-minute backend simulator for the integration and browser
checks. Start the backend first, then run it from the repository root with a confirmed
user that has at least one confirmed contact:

```bash
PB_TEST_EMAIL='user@example.com' PB_TEST_PASSWORD='password' \
  backend/.venv/bin/python backend/scripts/simulate_realtime_alert.py
```

The script creates a real alert, sends its normal notifications, publishes a circular
route around central Caracas every five seconds, and stops the alert after ten minutes.
Credentials are read only from the process environment.

### Verification record

On September 8, 2026, local backend Alert 1 completed a ten-minute simulated
route around central Caracas. The publisher authenticated once, the backend
acknowledged 120 numbered location updates at five-second intervals, and the
authenticated stop endpoint left the alert in `ended` state. A final API lookup
confirmed the latest coordinate was persisted and the single email notification's
`viewed_at` value was recorded. Telegram, WhatsApp, SMS, the Android app, and
multi-viewer/reconnect behavior were outside this test.

The first browser review exposed a blocked Leaflet stylesheet caused by an incorrect
subresource-integrity digest. This made successfully downloaded tile images flow
through the document instead of being positioned by Leaflet. The digest was corrected
to Leaflet 1.9.4's official `sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=`
value, and the map container now clips accidental overflow. Chrome's
DevTools-specific `/.well-known/appspecific/com.chrome.devtools.json` 404 requires no
application route.
