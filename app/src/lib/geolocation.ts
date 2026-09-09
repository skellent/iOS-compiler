import { Geolocation } from "@capacitor/geolocation";

export async function getCurrentCoordinates() {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed != null && position.coords.speed >= 0 ? position.coords.speed : null,
      bearing: position.coords.heading != null && position.coords.heading >= 0 ? position.coords.heading : null,
    };
  } catch {
    throw new Error("Couldn't get your location. Make sure location access is enabled for Panic Button.");
  }
}
// TypeScript source.
