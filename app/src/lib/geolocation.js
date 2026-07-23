import { Geolocation } from "@capacitor/geolocation";

export async function getCurrentCoordinates() {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
    });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    throw new Error("Couldn't get your location. Make sure location access is enabled for PanicSwitch.");
  }
}
