import { Capacitor, registerPlugin } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

const BASE_URL = import.meta.env.API_BASE_URL;
const HEARTBEAT_MS = 25000;
const MAX_RECONNECT_MS = 30000;
const SESSION_KEY = "panicbutton.liveTracking";

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

type TrackingState = {
  active: boolean;
  connected: boolean;
  stopping: boolean;
  alertId: number | null;
  startedAt: string | null;
  expiresAt: string | null;
  lastUpdateAt: string | null;
  error: string | null;
};

let state: TrackingState = {
  active: false,
  connected: false,
  stopping: false,
  alertId: null,
  startedAt: null,
  expiresAt: null,
  lastUpdateAt: null,
  error: null,
};

let listener: ((state: TrackingState) => void) | null = null;
let publisherToken: string | null = null;
let socket: WebSocket | null = null;
let watcherId: string | null = null;
let fallbackWatcherId: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let authenticated = false;
let sequence = 0;
let pendingLocation: Record<string, unknown> | null = null;

function publishState(patch: Partial<TrackingState>) {
  state = { ...state, ...patch };
  listener?.({ ...state });
}

async function persistSession() {
  if (!state.active || !publisherToken) return;
  await Preferences.set({
    key: SESSION_KEY,
    value: JSON.stringify({
      alertId: state.alertId,
      publisherToken,
      startedAt: state.startedAt,
      expiresAt: state.expiresAt,
      lastUpdateAt: state.lastUpdateAt,
      sequence,
      watcherId,
    }),
  });
}

export function getLiveTrackingState(): TrackingState {
  return { ...state };
}

export function observeLiveTracking(nextListener: (nextState: TrackingState) => void) {
  listener = nextListener;
  nextListener({ ...state });
}

function websocketUrl(alertId: number): string {
  const base = new URL(BASE_URL);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = `${base.pathname.replace(/\/$/, "")}/alerts/${alertId}/track`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

function clearTimer(timer: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | null) {
  if (timer !== null) clearTimeout(timer);
}

function sendPendingLocation() {
  if (!authenticated || !pendingLocation || socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(pendingLocation));
}

function scheduleReconnect() {
  if (!state.active || state.stopping || reconnectTimer !== null) return;
  const delay = Math.min(MAX_RECONNECT_MS, 1000 * (2 ** Math.min(reconnectAttempt, 5)));
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  if (!state.active || !state.alertId || !publisherToken) return;
  authenticated = false;
  const currentSocket = new WebSocket(websocketUrl(state.alertId));
  socket = currentSocket;

  currentSocket.addEventListener("open", () => {
    if (socket !== currentSocket) return;
    currentSocket.send(JSON.stringify({ type: "auth", token: publisherToken }));
  });
  currentSocket.addEventListener("message", (event) => {
    if (socket !== currentSocket) return;
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === "ready") {
      authenticated = true;
      reconnectAttempt = 0;
      sequence = Math.max(sequence, Number(message.latest_sequence) || 0);
      if (pendingLocation && Number(pendingLocation.sequence) <= sequence) {
        sequence += 1;
        pendingLocation.sequence = sequence;
      }
      publishState({ connected: true, error: null });
      sendPendingLocation();
      clearTimer(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
      }, HEARTBEAT_MS);
    } else if (message.type === "ack" && pendingLocation?.sequence === message.sequence) {
      pendingLocation = null;
    } else if (message.type === "status" && message.status !== "active") {
      stopLocally(message.status === "expired" ? "Tracking time expired." : null);
    }
  });
  currentSocket.addEventListener("close", (event) => {
    if (socket !== currentSocket) return;
    authenticated = false;
    clearTimer(heartbeatTimer);
    heartbeatTimer = null;
    publishState({ connected: false });
    if (event.code === 4401 || event.code === 4409) {
      stopLocally(event.reason || "The tracking session ended.");
      return;
    }
    scheduleReconnect();
  });
  currentSocket.addEventListener("error", () => {
    if (socket === currentSocket) publishState({ connected: false });
  });
}

function queueLocation(location) {
  if (!state.active || !location) return;
  sequence += 1;
  const recordedAt = location.time ? new Date(location.time).toISOString() : new Date().toISOString();
  pendingLocation = {
    type: "location",
    sequence,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy ?? null,
    speed: location.speed != null && location.speed >= 0 ? location.speed : null,
    bearing: location.bearing != null && location.bearing >= 0 ? location.bearing : null,
    recorded_at: recordedAt,
  };
  publishState({ lastUpdateAt: recordedAt });
  void persistSession();
  sendPendingLocation();
}

function locationErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const message = "message" in error && typeof error.message === "string" ? error.message.trim() : "";
    const code = "code" in error && typeof error.code === "string" ? error.code.trim() : "";
    if (message && code) return `${message} (${code})`;
    if (message) return message;
    if (code) return `${fallback} (${code})`;
  }
  return fallback;
}

async function requestTrackingNotificationPermission() {
  // Android uses a persistent notification for its foreground location
  // service. iOS exposes background location with the system indicator and
  // does not need a local-notification permission prompt for this feature.
  if (Capacitor.getPlatform() !== "android") return;

  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display === "prompt") {
      await LocalNotifications.requestPermissions();
    }
  } catch (error) {
    // A notification-plugin problem must not prevent the GPS watcher from
    // starting. Android will still report any foreground-service failure.
    console.warn("Could not check tracking notification permission", error);
  }
}

async function startWatcher() {
  await requestTrackingNotificationPermission();

  try {
    watcherId = await BackgroundGeolocation.addWatcher({
      backgroundMessage: "Your live emergency location is being shared. Tap to return to Panic Button.",
      backgroundTitle: "Panic Button live tracking",
      requestPermissions: true,
      stale: false,
      distanceFilter: 10,
    }, (location, error) => {
      if (error) {
        publishState({ error: locationErrorMessage(error, "Couldn't update your location.") });
        return;
      }
      queueLocation(location);
    });
    await persistSession();
    return;
  } catch (backgroundError) {
    console.warn("Background location watcher unavailable", backgroundError);
  }

  try {
    // Browser fallback keeps development and older shells functional in foreground.
    fallbackWatcherId = await Geolocation.watchPosition({
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 5000,
      minimumUpdateInterval: 5000,
    }, (position, error) => {
      if (error || !position) {
        publishState({ error: locationErrorMessage(error, "Couldn't update your location.") });
        return;
      }
      queueLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        bearing: position.coords.heading,
        time: position.timestamp,
      });
    });
    publishState({ error: "Background tracking is unavailable. Keep Panic Button open while sharing." });
  } catch (fallbackError) {
    throw new Error(locationErrorMessage(fallbackError, "Couldn't start location tracking."));
  }
}

async function removeWatcher() {
  if (watcherId !== null) {
    await BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
    watcherId = null;
  }
  if (fallbackWatcherId !== null) {
    await Geolocation.clearWatch({ id: fallbackWatcherId }).catch(() => {});
    fallbackWatcherId = null;
  }
}

export async function startLiveTracking(alert) {
  await stopLocally();
  publisherToken = alert.publisher_token;
  sequence = 0;
  pendingLocation = null;
  publishState({
    active: true,
    connected: false,
    stopping: false,
    alertId: alert.id,
    startedAt: alert.created_at,
    expiresAt: alert.tracking_expires_at,
    lastUpdateAt: alert.created_at,
    error: null,
  });
  await persistSession();
  connect();
  await startWatcher();

  const expiresIn = Math.max(0, new Date(alert.tracking_expires_at).getTime() - Date.now());
  expiryTimer = setTimeout(() => stopLocally("Tracking time expired."), expiresIn);
}

export async function restoreLiveTracking() {
  const { value } = await Preferences.get({ key: SESSION_KEY });
  if (!value || state.active) return;
  let saved;
  try { saved = JSON.parse(value); } catch {
    await Preferences.remove({ key: SESSION_KEY });
    return;
  }
  if (!saved.alertId || !saved.publisherToken || !saved.expiresAt || new Date(saved.expiresAt).getTime() <= Date.now()) {
    await Preferences.remove({ key: SESSION_KEY });
    return;
  }

  if (saved.watcherId) {
    await BackgroundGeolocation.removeWatcher({ id: saved.watcherId }).catch(() => {});
  }
  publisherToken = saved.publisherToken;
  sequence = Number(saved.sequence) || 0;
  publishState({
    active: true,
    connected: false,
    stopping: false,
    alertId: saved.alertId,
    startedAt: saved.startedAt,
    expiresAt: saved.expiresAt,
    lastUpdateAt: saved.lastUpdateAt,
    error: null,
  });
  connect();
  await startWatcher();
  expiryTimer = setTimeout(() => stopLocally("Tracking time expired."), new Date(saved.expiresAt).getTime() - Date.now());
}

export async function stopLiveTracking(stopRequest: (alertId: number) => Promise<unknown>) {
  if (!state.active || !state.alertId || state.stopping) return;
  publishState({ stopping: true });
  try {
    await stopRequest(state.alertId);
    await stopLocally();
  } catch (error) {
    publishState({ stopping: false, error: error instanceof Error ? error.message : "Couldn't stop live tracking." });
    throw error;
  }
}

export async function stopLiveTrackingLocally() {
  await stopLocally();
}

async function stopLocally(error: string | null = null) {
  clearTimer(reconnectTimer);
  clearTimer(heartbeatTimer);
  clearTimer(expiryTimer);
  reconnectTimer = null;
  heartbeatTimer = null;
  expiryTimer = null;
  await removeWatcher();
  if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000);
  socket = null;
  publisherToken = null;
  authenticated = false;
  pendingLocation = null;
  await Preferences.remove({ key: SESSION_KEY });
  publishState({ active: false, connected: false, stopping: false, alertId: null, error });
}
