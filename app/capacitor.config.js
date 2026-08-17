require("dotenv").config();

const apiBaseUrl = (process.env.API_BASE_URL || "http://10.0.2.2:8000").replace(/\/+$/, "");

const config = {
  appId: "com.keycodelogics.panicbutton",
  appName: "Panic Button",
  webDir: "www",
  server: {
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
