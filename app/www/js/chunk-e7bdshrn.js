import {
  WebPlugin
} from "./main.js";

// node_modules/@capacitor/browser/dist/esm/web.js
class BrowserWeb extends WebPlugin {
  constructor() {
    super();
    this._lastWindow = null;
  }
  async open(options) {
    this._lastWindow = window.open(options.url, options.windowName || "_blank");
  }
  async close() {
    return new Promise((resolve, reject) => {
      if (this._lastWindow != null) {
        this._lastWindow.close();
        this._lastWindow = null;
        resolve();
      } else {
        reject("No active window to close!");
      }
    });
  }
}
var Browser = new BrowserWeb;
export {
  BrowserWeb
};
