import { Api } from "./api.js";

let cached = null;

export function getFeatures() {
  if (!cached) {
    cached = Api.getFeatures().catch(() => ({ telegram: false }));
  }
  return cached;
}
