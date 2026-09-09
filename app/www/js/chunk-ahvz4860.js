import {
  WebPlugin
} from "./chunk-76h33zks.js";

// node_modules/@capacitor/geolocation/dist/esm/web.js
class GeolocationWeb extends WebPlugin {
  constructor() {
    super();
    this.latestOrientation = null;
    if (typeof window !== "undefined") {
      const win = window;
      if ("ondeviceorientationabsolute" in win) {
        win.addEventListener("deviceorientationabsolute", (event) => this.updateOrientation(event, true), true);
      } else if ("ondeviceorientation" in win) {
        win.addEventListener("deviceorientation", (event) => this.updateOrientation(event, false), true);
      }
    }
  }
  updateOrientation(event, isAbsolute) {
    let trueHeading = null;
    let magneticHeading = null;
    let headingAccuracy = null;
    if (isAbsolute && event.alpha !== null) {
      trueHeading = (360 - event.alpha) % 360;
    } else if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
      magneticHeading = event.webkitCompassHeading;
      headingAccuracy = event.webkitCompassAccuracy;
    } else if (event.alpha !== null && event.absolute === true) {
      trueHeading = (360 - event.alpha) % 360;
    } else if (event.alpha !== null) {
      magneticHeading = (360 - event.alpha) % 360;
    }
    if (trueHeading !== null || magneticHeading !== null) {
      this.latestOrientation = {
        trueHeading,
        magneticHeading,
        headingAccuracy
      };
    }
  }
  augmentPosition(pos, isWatch = false) {
    var _a, _b, _c, _d, _e, _f, _g;
    const coords = pos.coords;
    const orientation = isWatch ? this.latestOrientation : null;
    const heading = (_c = (_b = (_a = orientation === null || orientation === undefined ? undefined : orientation.trueHeading) !== null && _a !== undefined ? _a : orientation === null || orientation === undefined ? undefined : orientation.magneticHeading) !== null && _b !== undefined ? _b : isWatch ? coords.heading : null) !== null && _c !== undefined ? _c : null;
    return {
      timestamp: pos.timestamp,
      coords: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        altitude: coords.altitude,
        altitudeAccuracy: coords.altitudeAccuracy,
        speed: coords.speed,
        heading,
        magneticHeading: (_d = orientation === null || orientation === undefined ? undefined : orientation.magneticHeading) !== null && _d !== undefined ? _d : null,
        trueHeading: (_e = orientation === null || orientation === undefined ? undefined : orientation.trueHeading) !== null && _e !== undefined ? _e : null,
        headingAccuracy: (_f = orientation === null || orientation === undefined ? undefined : orientation.headingAccuracy) !== null && _f !== undefined ? _f : null,
        course: (_g = isWatch ? coords.heading : null) !== null && _g !== undefined ? _g : null
      }
    };
  }
  async getCurrentPosition(options) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition((pos) => {
        resolve(this.augmentPosition(pos, false));
      }, (err) => {
        reject(err);
      }, Object.assign({ enableHighAccuracy: false, timeout: 1e4, maximumAge: 0 }, options));
    });
  }
  async watchPosition(options, callback) {
    const id = navigator.geolocation.watchPosition((pos) => {
      callback(this.augmentPosition(pos, true));
    }, (err) => {
      callback(null, err);
    }, Object.assign({ enableHighAccuracy: false, timeout: 1e4, maximumAge: 0, minimumUpdateInterval: 5000 }, options));
    return `${id}`;
  }
  async clearWatch(options) {
    navigator.geolocation.clearWatch(parseInt(options.id, 10));
  }
  async checkPermissions() {
    if (typeof navigator === "undefined" || !navigator.permissions) {
      throw this.unavailable("Permissions API not available in this browser");
    }
    const permission = await navigator.permissions.query({
      name: "geolocation"
    });
    return { location: permission.state, coarseLocation: permission.state };
  }
  async requestPermissions() {
    throw this.unimplemented("Not implemented on web.");
  }
}
var Geolocation = new GeolocationWeb;
export {
  Geolocation,
  GeolocationWeb
};
