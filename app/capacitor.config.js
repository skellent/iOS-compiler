require("dotenv").config();

const apiBaseUrl = (process.env.API_BASE_URL || "http://10.0.2.2:8000").replace(/\/+$/, "");

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: "com.keycodelogics.panicbutton",
  appName: "Panic Button",
  webDir: "www",
  server: {
    // The WebView navigates straight to the backend's own /app route instead
    // of loading the www/ bundle from inside the native binary — see
    // docs/app/architecture.md. Same API_BASE_URL used by build.js, so
    // pointing this at a different backend only ever means editing .env.
    url: `${apiBaseUrl}/app/`,
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#ea2052",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#f3f3f3ff",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

module.exports = config;
