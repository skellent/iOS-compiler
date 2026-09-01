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

async function checkForUpdate() {
  let latest;
  try {
    latest = await fetchManifestVersion();
  } catch {
    return;
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
// TypeScript source.
