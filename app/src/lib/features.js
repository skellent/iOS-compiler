import { Api } from "./api.js";

// GET /features is deployment-wide and doesn't change while the app is
// running, so the first call's promise is cached and reused instead of
// hitting the network again every time a screen needs it.
let cached = null;

export function getFeatures() {
  if (!cached) {
    // Unauthenticated, but still a network call — if it fails for any
    // reason, fail closed (nothing is "on") rather than crash whatever
    // screen asked, or cache a rejected promise that never recovers.
    cached = Api.getFeatures().catch(() => ({ telegram: false }));
  }
  return cached;
}
