import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";

const VERSION_KEY = "panicbutton.appVersion";
const BASE_URL = import.meta.env.API_BASE_URL;

async function fetchManifestVersion() {
  const response = await fetch(`${BASE_URL}/app/manifest`, { cache: "no-store" });
  if (!response.ok) return null;
  const { version } = await response.json();
  return version;
}

// The WebView keeps running whatever it already loaded until something makes
// it navigate again — a fresh deploy on the backend doesn't reach an app a
// user left open in the background on its own. This compares the backend's
// current content hash (GET /app/manifest, see backend/modules/app_assets.py)
// against the one from the last time this ran, and reloads only when it
// actually changed; a first run just remembers the version without reloading
// since the page was already loaded fresh moments ago. Static assets are
// served with Cache-Control: no-cache (see main.py), so the reload this
// triggers always revalidates against the server instead of the WebView's
// own disk cache serving the old files back.
async function checkForUpdate() {
  let latest;
  try {
    latest = await fetchManifestVersion();
  } catch {
    return; // offline or backend unreachable — nothing to do
  }
  if (!latest) return;

  const { value: known } = await Preferences.get({ key: VERSION_KEY });
  if (known === null) {
    await Preferences.set({ key: VERSION_KEY, value: latest });
    return;
  }
  if (known !== latest) {
    await Preferences.set({ key: VERSION_KEY, value: latest });
    window.location.reload();
  }
}

export function initAppUpdates() {
  checkForUpdate();
  App.addListener("resume", checkForUpdate);
}
