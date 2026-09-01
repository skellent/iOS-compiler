import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

async function copyToClipboard(url) {
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

export async function shareLink({ url, title, text }) {
  // Older installed binaries won't have the native Share plugin even though they
  // load this (newer) JS live from the server — fall back to the old behaviour.
  if (!Capacitor.isPluginAvailable("Share")) {
    return copyToClipboard(url);
  }
  try {
    await Share.share({ title, text, url });
    return "shared";
  } catch {
    return copyToClipboard(url);
  }
}
// TypeScript source.
