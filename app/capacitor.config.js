require("dotenv").config();

const apiBaseUrl = (process.env.API_BASE_URL || "http://192.168.0.113:8000").replace(/\/+$/, "");

const config = {
  appId: "com.keycodelogics.panicbutton",
  appName: "Panic Button",
  webDir: "www",
  server: {
    url: `${apiBaseUrl}/app/`,
    cleartext: true,
    errorPath: "offline.html",
  },
  android: {
    // Required by the background-geolocation plugin so background watchers
    // continue past Android's WebView background timeout.
    useLegacyBridge: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#ff0040",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

module.exports = config;
