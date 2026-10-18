import {
  WebPlugin
} from "./main.js";

// node_modules/@capacitor/splash-screen/dist/esm/web.js
class SplashScreenWeb extends WebPlugin {
  async show(_options) {
    return;
  }
  async hide(_options) {
    return;
  }
}
export {
  SplashScreenWeb
};
