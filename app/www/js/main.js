var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// node_modules/@capacitor/core/dist/index.js
class WebPlugin {
  constructor() {
    this.listeners = {};
    this.retainedEventArguments = {};
    this.windowListeners = {};
  }
  addListener(eventName, listenerFunc) {
    let firstListener = false;
    const listeners = this.listeners[eventName];
    if (!listeners) {
      this.listeners[eventName] = [];
      firstListener = true;
    }
    this.listeners[eventName].push(listenerFunc);
    const windowListener = this.windowListeners[eventName];
    if (windowListener && !windowListener.registered) {
      this.addWindowListener(windowListener);
    }
    if (firstListener) {
      this.sendRetainedArgumentsForEvent(eventName);
    }
    const remove = async () => this.removeListener(eventName, listenerFunc);
    const p = Promise.resolve({ remove });
    return p;
  }
  async removeAllListeners() {
    this.listeners = {};
    for (const listener in this.windowListeners) {
      this.removeWindowListener(this.windowListeners[listener]);
    }
    this.windowListeners = {};
  }
  notifyListeners(eventName, data, retainUntilConsumed) {
    const listeners = this.listeners[eventName];
    if (!listeners) {
      if (retainUntilConsumed) {
        let args = this.retainedEventArguments[eventName];
        if (!args) {
          args = [];
        }
        args.push(data);
        this.retainedEventArguments[eventName] = args;
      }
      return;
    }
    listeners.forEach((listener) => listener(data));
  }
  hasListeners(eventName) {
    var _a;
    return !!((_a = this.listeners[eventName]) === null || _a === undefined ? undefined : _a.length);
  }
  registerWindowListener(windowEventName, pluginEventName) {
    this.windowListeners[pluginEventName] = {
      registered: false,
      windowEventName,
      pluginEventName,
      handler: (event) => {
        this.notifyListeners(pluginEventName, event);
      }
    };
  }
  unimplemented(msg = "not implemented") {
    return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
  }
  unavailable(msg = "not available") {
    return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
  }
  async removeListener(eventName, listenerFunc) {
    const listeners = this.listeners[eventName];
    if (!listeners) {
      return;
    }
    const index = listeners.indexOf(listenerFunc);
    this.listeners[eventName].splice(index, 1);
    if (!this.listeners[eventName].length) {
      this.removeWindowListener(this.windowListeners[eventName]);
    }
  }
  addWindowListener(handle) {
    window.addEventListener(handle.windowEventName, handle.handler);
    handle.registered = true;
  }
  removeWindowListener(handle) {
    if (!handle) {
      return;
    }
    window.removeEventListener(handle.windowEventName, handle.handler);
    handle.registered = false;
  }
  sendRetainedArgumentsForEvent(eventName) {
    const args = this.retainedEventArguments[eventName];
    if (!args) {
      return;
    }
    delete this.retainedEventArguments[eventName];
    args.forEach((arg) => {
      this.notifyListeners(eventName, arg);
    });
  }
}
var ExceptionCode, CapacitorException, getPlatformId = (win) => {
  var _a, _b;
  if (win === null || win === undefined ? undefined : win.androidBridge) {
    return "android";
  } else if ((_b = (_a = win === null || win === undefined ? undefined : win.webkit) === null || _a === undefined ? undefined : _a.messageHandlers) === null || _b === undefined ? undefined : _b.bridge) {
    return "ios";
  } else {
    return "web";
  }
}, createCapacitor = (win) => {
  const capCustomPlatform = win.CapacitorCustomPlatform || null;
  const cap = win.Capacitor || {};
  const Plugins = cap.Plugins = cap.Plugins || {};
  const getPlatform = () => {
    return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
  };
  const isNativePlatform = () => getPlatform() !== "web";
  const isPluginAvailable = (pluginName) => {
    const plugin = registeredPlugins.get(pluginName);
    if (plugin === null || plugin === undefined ? undefined : plugin.platforms.has(getPlatform())) {
      return true;
    }
    if (getPluginHeader(pluginName)) {
      return true;
    }
    return false;
  };
  const getPluginHeader = (pluginName) => {
    var _a;
    return (_a = cap.PluginHeaders) === null || _a === undefined ? undefined : _a.find((h) => h.name === pluginName);
  };
  const handleError = (err) => win.console.error(err);
  const registeredPlugins = new Map;
  const registerPlugin = (pluginName, jsImplementations = {}) => {
    const registeredPlugin = registeredPlugins.get(pluginName);
    if (registeredPlugin) {
      console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
      return registeredPlugin.proxy;
    }
    const platform = getPlatform();
    const pluginHeader = getPluginHeader(pluginName);
    let jsImplementation;
    const loadPluginImplementation = async () => {
      if (!jsImplementation && platform in jsImplementations) {
        jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
      } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
        jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
      }
      return jsImplementation;
    };
    const createPluginMethod = (impl, prop) => {
      var _a, _b;
      if (pluginHeader) {
        const methodHeader = pluginHeader === null || pluginHeader === undefined ? undefined : pluginHeader.methods.find((m) => prop === m.name);
        if (methodHeader) {
          if (methodHeader.rtype === "promise") {
            return (options) => cap.nativePromise(pluginName, prop.toString(), options);
          } else {
            return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
          }
        } else if (impl) {
          return (_a = impl[prop]) === null || _a === undefined ? undefined : _a.bind(impl);
        }
      } else if (impl) {
        return (_b = impl[prop]) === null || _b === undefined ? undefined : _b.bind(impl);
      } else {
        throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
      }
    };
    const createPluginMethodWrapper = (prop) => {
      let remove;
      const wrapper = (...args) => {
        const p = loadPluginImplementation().then((impl) => {
          const fn = createPluginMethod(impl, prop);
          if (fn) {
            const p2 = fn(...args);
            remove = p2 === null || p2 === undefined ? undefined : p2.remove;
            return p2;
          } else {
            throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
          }
        });
        if (prop === "addListener") {
          p.remove = async () => remove();
        }
        return p;
      };
      wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
      Object.defineProperty(wrapper, "name", {
        value: prop,
        writable: false,
        configurable: false
      });
      return wrapper;
    };
    const addListener = createPluginMethodWrapper("addListener");
    const removeListener = createPluginMethodWrapper("removeListener");
    const addListenerNative = (eventName, callback) => {
      const call = addListener({ eventName }, callback);
      const remove = async () => {
        const callbackId = await call;
        removeListener({
          eventName,
          callbackId
        }, callback);
      };
      const p = new Promise((resolve) => call.then(() => resolve({ remove })));
      p.remove = async () => {
        console.warn(`Using addListener() without 'await' is deprecated.`);
        await remove();
      };
      return p;
    };
    const proxy = new Proxy({}, {
      get(_, prop) {
        switch (prop) {
          case "$$typeof":
            return;
          case "toJSON":
            return () => ({});
          case "addListener":
            return pluginHeader ? addListenerNative : addListener;
          case "removeListener":
            return removeListener;
          default:
            return createPluginMethodWrapper(prop);
        }
      }
    });
    Plugins[pluginName] = proxy;
    registeredPlugins.set(pluginName, {
      name: pluginName,
      proxy,
      platforms: new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
    });
    return proxy;
  };
  if (!cap.convertFileSrc) {
    cap.convertFileSrc = (filePath) => filePath;
  }
  cap.getPlatform = getPlatform;
  cap.handleError = handleError;
  cap.isNativePlatform = isNativePlatform;
  cap.isPluginAvailable = isPluginAvailable;
  cap.registerPlugin = registerPlugin;
  cap.Exception = CapacitorException;
  cap.DEBUG = !!cap.DEBUG;
  cap.isLoggingEnabled = !!cap.isLoggingEnabled;
  return cap;
}, initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win), Capacitor, registerPlugin, encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape), decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent), CapacitorCookiesPluginWeb, CapacitorCookies, readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader;
  reader.onload = () => {
    const base64String = reader.result;
    resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
  };
  reader.onerror = (error) => reject(error);
  reader.readAsDataURL(blob);
}), normalizeHttpHeaders = (headers = {}) => {
  const originalKeys = Object.keys(headers);
  const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
  const normalized = loweredKeys.reduce((acc, key, index) => {
    acc[key] = headers[originalKeys[index]];
    return acc;
  }, {});
  return normalized;
}, buildUrlParams = (params, shouldEncode = true) => {
  if (!params)
    return null;
  const output = Object.entries(params).reduce((accumulator, entry) => {
    const [key, value] = entry;
    let encodedValue;
    let item;
    if (Array.isArray(value)) {
      item = "";
      value.forEach((str) => {
        encodedValue = shouldEncode ? encodeURIComponent(str) : str;
        item += `${key}=${encodedValue}&`;
      });
      item.slice(0, -1);
    } else {
      encodedValue = shouldEncode ? encodeURIComponent(value) : value;
      item = `${key}=${encodedValue}`;
    }
    return `${accumulator}&${item}`;
  }, "");
  return output.substr(1);
}, buildRequestInit = (options, extra = {}) => {
  const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
  const headers = normalizeHttpHeaders(options.headers);
  const type = headers["content-type"] || "";
  if (typeof options.data === "string") {
    output.body = options.data;
  } else if (type.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams;
    for (const [key, value] of Object.entries(options.data || {})) {
      params.set(key, value);
    }
    output.body = params.toString();
  } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
    const form = new FormData;
    if (options.data instanceof FormData) {
      options.data.forEach((value, key) => {
        form.append(key, value);
      });
    } else {
      for (const key of Object.keys(options.data)) {
        form.append(key, options.data[key]);
      }
    }
    output.body = form;
    const headers2 = new Headers(output.headers);
    headers2.delete("content-type");
    output.headers = headers2;
  } else if (type.includes("application/json") || typeof options.data === "object") {
    output.body = JSON.stringify(options.data);
  }
  return output;
}, CapacitorHttpPluginWeb, CapacitorHttp, SystemBarsStyle, SystemBarType, SystemBarsPluginWeb, SystemBars;
var init_dist = __esm(() => {
  /*! Capacitor: https://capacitorjs.com/ - MIT License */
  (function(ExceptionCode2) {
    ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
    ExceptionCode2["Unavailable"] = "UNAVAILABLE";
  })(ExceptionCode || (ExceptionCode = {}));
  CapacitorException = class CapacitorException extends Error {
    constructor(message, code, data) {
      super(message);
      this.message = message;
      this.code = code;
      this.data = data;
    }
  };
  Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
  registerPlugin = Capacitor.registerPlugin;
  CapacitorCookiesPluginWeb = class CapacitorCookiesPluginWeb extends WebPlugin {
    async getCookies() {
      const cookies = document.cookie;
      const cookieMap = {};
      cookies.split(";").forEach((cookie) => {
        if (cookie.length <= 0)
          return;
        let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
        key = decode(key).trim();
        value = decode(value).trim();
        cookieMap[key] = value;
      });
      return cookieMap;
    }
    async setCookie(options) {
      try {
        const encodedKey = encode(options.key);
        const encodedValue = encode(options.value);
        const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
        const path = (options.path || "/").replace("path=", "");
        const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
        document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async deleteCookie(options) {
      try {
        document.cookie = `${options.key}=; Max-Age=0`;
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async clearCookies() {
      try {
        const cookies = document.cookie.split(";") || [];
        for (const cookie of cookies) {
          document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
        }
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async clearAllCookies() {
      try {
        await this.clearCookies();
      } catch (error) {
        return Promise.reject(error);
      }
    }
  };
  CapacitorCookies = registerPlugin("CapacitorCookies", {
    web: () => new CapacitorCookiesPluginWeb
  });
  CapacitorHttpPluginWeb = class CapacitorHttpPluginWeb extends WebPlugin {
    async request(options) {
      const requestInit = buildRequestInit(options, options.webFetchExtra);
      const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
      const url = urlParams ? `${options.url}?${urlParams}` : options.url;
      const response = await fetch(url, requestInit);
      const contentType = response.headers.get("content-type") || "";
      let { responseType = "text" } = response.ok ? options : {};
      if (contentType.includes("application/json")) {
        responseType = "json";
      }
      let data;
      let blob;
      switch (responseType) {
        case "arraybuffer":
        case "blob":
          blob = await response.blob();
          data = await readBlobAsBase64(blob);
          break;
        case "json":
          data = await response.json();
          break;
        case "document":
        case "text":
        default:
          data = await response.text();
      }
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return {
        data,
        headers,
        status: response.status,
        url: response.url
      };
    }
    async get(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
    }
    async post(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
    }
    async put(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
    }
    async patch(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
    }
    async delete(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
    }
  };
  CapacitorHttp = registerPlugin("CapacitorHttp", {
    web: () => new CapacitorHttpPluginWeb
  });
  (function(SystemBarsStyle2) {
    SystemBarsStyle2["Dark"] = "DARK";
    SystemBarsStyle2["Light"] = "LIGHT";
    SystemBarsStyle2["Default"] = "DEFAULT";
  })(SystemBarsStyle || (SystemBarsStyle = {}));
  (function(SystemBarType2) {
    SystemBarType2["StatusBar"] = "StatusBar";
    SystemBarType2["NavigationBar"] = "NavigationBar";
  })(SystemBarType || (SystemBarType = {}));
  SystemBarsPluginWeb = class SystemBarsPluginWeb extends WebPlugin {
    async setStyle() {
      this.unavailable("not available for web");
    }
    async setAnimation() {
      this.unavailable("not available for web");
    }
    async show() {
      this.unavailable("not available for web");
    }
    async hide() {
      this.unavailable("not available for web");
    }
  };
  SystemBars = registerPlugin("SystemBars", {
    web: () => new SystemBarsPluginWeb
  });
});

// node_modules/@capacitor/splash-screen/dist/esm/web.js
var exports_web = {};
__export(exports_web, {
  SplashScreenWeb: () => SplashScreenWeb
});
var SplashScreenWeb;
var init_web = __esm(() => {
  init_dist();
  SplashScreenWeb = class SplashScreenWeb extends WebPlugin {
    async show(_options) {
      return;
    }
    async hide(_options) {
      return;
    }
  };
});

// node_modules/@capacitor/preferences/dist/esm/web.js
var exports_web2 = {};
__export(exports_web2, {
  PreferencesWeb: () => PreferencesWeb
});
var PreferencesWeb;
var init_web2 = __esm(() => {
  init_dist();
  PreferencesWeb = class PreferencesWeb extends WebPlugin {
    constructor() {
      super(...arguments);
      this.group = "CapacitorStorage";
    }
    async configure({ group }) {
      if (typeof group === "string") {
        this.group = group;
      }
    }
    async get(options) {
      const value = this.impl.getItem(this.applyPrefix(options.key));
      return { value };
    }
    async set(options) {
      this.impl.setItem(this.applyPrefix(options.key), options.value);
    }
    async remove(options) {
      this.impl.removeItem(this.applyPrefix(options.key));
    }
    async keys() {
      const keys = this.rawKeys().map((k) => k.substring(this.prefix.length));
      return { keys };
    }
    async clear() {
      for (const key of this.rawKeys()) {
        this.impl.removeItem(key);
      }
    }
    async migrate() {
      var _a;
      const migrated = [];
      const existing = [];
      const oldprefix = "_cap_";
      const keys = Object.keys(this.impl).filter((k) => k.indexOf(oldprefix) === 0);
      for (const oldkey of keys) {
        const key = oldkey.substring(oldprefix.length);
        const value = (_a = this.impl.getItem(oldkey)) !== null && _a !== undefined ? _a : "";
        const { value: currentValue } = await this.get({ key });
        if (typeof currentValue === "string") {
          existing.push(key);
        } else {
          await this.set({ key, value });
          migrated.push(key);
        }
      }
      return { migrated, existing };
    }
    async removeOld() {
      const oldprefix = "_cap_";
      const keys = Object.keys(this.impl).filter((k) => k.indexOf(oldprefix) === 0);
      for (const oldkey of keys) {
        this.impl.removeItem(oldkey);
      }
    }
    get impl() {
      return window.localStorage;
    }
    get prefix() {
      return this.group === "NativeStorage" ? "" : `${this.group}.`;
    }
    rawKeys() {
      return Object.keys(this.impl).filter((k) => k.indexOf(this.prefix) === 0);
    }
    applyPrefix(key) {
      return this.prefix + key;
    }
  };
});

// node_modules/@capacitor/app/dist/esm/web.js
var exports_web3 = {};
__export(exports_web3, {
  AppWeb: () => AppWeb
});
var AppWeb;
var init_web3 = __esm(() => {
  init_dist();
  AppWeb = class AppWeb extends WebPlugin {
    constructor() {
      super();
      this.handleVisibilityChange = () => {
        const data = {
          isActive: document.hidden !== true
        };
        this.notifyListeners("appStateChange", data);
        if (document.hidden) {
          this.notifyListeners("pause", null);
        } else {
          this.notifyListeners("resume", null);
        }
      };
      document.addEventListener("visibilitychange", this.handleVisibilityChange, false);
    }
    exitApp() {
      throw this.unimplemented("Not implemented on web.");
    }
    async getInfo() {
      throw this.unimplemented("Not implemented on web.");
    }
    async getLaunchUrl() {
      return { url: "" };
    }
    async getState() {
      return { isActive: document.hidden !== true };
    }
    async minimizeApp() {
      throw this.unimplemented("Not implemented on web.");
    }
    async toggleBackButtonHandler() {
      throw this.unimplemented("Not implemented on web.");
    }
    async getAppLanguage() {
      return {
        value: navigator.language.split("-")[0].toLowerCase()
      };
    }
  };
});

// node_modules/@capacitor/geolocation/dist/esm/web.js
var exports_web4 = {};
__export(exports_web4, {
  GeolocationWeb: () => GeolocationWeb,
  Geolocation: () => Geolocation
});
var GeolocationWeb, Geolocation;
var init_web4 = __esm(() => {
  init_dist();
  GeolocationWeb = class GeolocationWeb extends WebPlugin {
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
  };
  Geolocation = new GeolocationWeb;
});

// node_modules/@capacitor-community/contacts/dist/esm/web.js
var exports_web5 = {};
__export(exports_web5, {
  ContactsWeb: () => ContactsWeb
});
var ContactsWeb;
var init_web5 = __esm(() => {
  init_dist();
  ContactsWeb = class ContactsWeb extends WebPlugin {
    async checkPermissions() {
      throw this.unimplemented("Not implemented on web.");
    }
    async requestPermissions() {
      throw this.unimplemented("Not implemented on web.");
    }
    async getContact() {
      throw this.unimplemented("Not implemented on web.");
    }
    async getContacts() {
      throw this.unimplemented("Not implemented on web.");
    }
    async createContact() {
      throw this.unimplemented("Not implemented on web.");
    }
    async deleteContact() {
      throw this.unimplemented("Not implemented on web.");
    }
    async pickContact() {
      throw this.unimplemented("Not implemented on web.");
    }
  };
});

// node_modules/@capacitor/splash-screen/dist/esm/index.js
init_dist();
var SplashScreen = registerPlugin("SplashScreen", {
  web: () => Promise.resolve().then(() => (init_web(), exports_web)).then((m) => new m.SplashScreenWeb)
});

// node_modules/@capacitor/preferences/dist/esm/index.js
init_dist();
var Preferences = registerPlugin("Preferences", {
  web: () => Promise.resolve().then(() => (init_web2(), exports_web2)).then((m) => new m.PreferencesWeb)
});

// src/lib/session.js
var TOKEN_KEY = "panicbutton.token";
var cachedUser = null;
async function getToken() {
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  return value;
}
async function setToken(token) {
  await Preferences.set({ key: TOKEN_KEY, value: token });
}
async function clearToken() {
  await Preferences.remove({ key: TOKEN_KEY });
  cachedUser = null;
}
function getUser() {
  return cachedUser;
}
function setUser(user) {
  cachedUser = user;
}

// src/lib/i18n.js
var LANG_KEY = "panicbutton.lang";
var LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "pt-PT", label: "Português (Portugal)" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "ru", label: "Русский" },
  { code: "zh", label: "中文（简体）" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "hi", label: "हिन्दी" }
];
var SUPPORTED = LANGUAGES.map((l) => l.code);
var STRINGS = {
  en: {
    "nav.home": "Home",
    "nav.contacts": "Contacts",
    "nav.profile": "Profile",
    "route.login.title": "Log In",
    "route.register.title": "Create Account",
    "route.contacts.title": "Emergency Contacts",
    "route.profile.title": "My Profile",
    "route.about.title": "About",
    "route.help.title": "Help",
    "errors.generic": "Something went wrong. Please try again.",
    "errors.network": "Can't reach the server. Check your connection.",
    "login.subtitle": "Sign in to keep your emergency contacts one tap away.",
    "login.email": "Email",
    "login.password": "Password",
    "login.submit": "Log In",
    "login.switch": "Don't have an account?",
    "login.switchLink": "Create one",
    "register.subtitle": "A few details, and you're ready to add your emergency contacts.",
    "register.name": "Full name",
    "register.phone": "Phone",
    "register.email": "Email",
    "register.password": "Password",
    "register.confirmPassword": "Confirm password",
    "register.submit": "Create Account",
    "register.switch": "Already have an account?",
    "register.switchLink": "Log in",
    "register.passwordMismatch": "Passwords don't match.",
    "confirmMail.title": "Check your email",
    "confirmMail.subtitle": 'We sent a confirmation link to<br /><span class="confirm-mail-email">{email}</span>. Open it on this device to activate your account, then come back and log in.',
    "confirmMail.back": "Back to Log In",
    "home.greeting": "Hi, {name}",
    "home.panicAria": "Hold to send a panic alert",
    "home.idle": "Press and hold to alert your contacts",
    "home.holding": "Keep holding to confirm...",
    "home.locating": "Getting your location...",
    "home.sending": "Sending alert...",
    "home.sent": "Alert sent — your contacts are being notified",
    "home.sentToast": "Panic alert sent successfully.",
    "home.errorFallback": "Couldn't send the alert.",
    "home.statusReady": "{count} contact ready to be alerted",
    "home.statusReadyPlural": "{count} contacts ready to be alerted",
    "home.statusNone": "No confirmed contacts yet",
    "home.noContacts": "No confirmed contacts yet — add and confirm a contact before sending an alert.",
    "contacts.empty": "No emergency contacts yet. Tap the + button to add someone who should be notified when you trigger a panic alert.",
    "contacts.loadError": "Couldn't load your contacts. Pull down or reopen this tab to try again.",
    "contacts.loadErrorToast": "Couldn't load contacts.",
    "contacts.limitReached": "You've reached the limit of {max} emergency contacts.",
    "contacts.confirmed": "Confirmed",
    "contacts.pending": "Pending",
    "contacts.addTitle": "Add Emergency Contact",
    "contacts.pickDevice": "Pick from device contacts",
    "contacts.addManually": "Add manually",
    "contacts.editTitle": "Edit Contact",
    "contacts.name": "Name",
    "contacts.phone": "Phone",
    "contacts.email": "Email",
    "contacts.emailRequired": "Please enter an email for this contact.",
    "contacts.emailHint": "We'll send this contact a confirmation link by email — only confirmed contacts are notified during a panic alert.",
    "contacts.save": "Save Changes",
    "contacts.add": "Add Contact",
    "contacts.delete": "Delete Contact",
    "contacts.updated": "Contact updated.",
    "contacts.addedWithEmail": "Contact added — confirmation email sent.",
    "contacts.removed": "Contact removed.",
    "contacts.removeError": "Couldn't remove contact.",
    "contacts.removeConfirm": "Remove {name} from your emergency contacts?",
    "contacts.pickError": "Couldn't access your contacts.",
    "contacts.telegramLinked": "Telegram linked",
    "contacts.telegramNotLinked": "Telegram not linked",
    "contacts.resendConfirmation": "Resend confirmation email",
    "contacts.resendConfirmationSent": "Confirmation email sent again.",
    "contacts.telegramConnect": "Connect Telegram",
    "contacts.telegramDisconnect": "Disconnect Telegram",
    "contacts.telegramEmailSent": "Telegram link sent to their email.",
    "contacts.telegramLinkReady": "Telegram link ready — copied, share it with your contact.",
    "contacts.telegramDisconnected": "Telegram disconnected.",
    "contacts.telegramEnableError": "Couldn't start the Telegram link.",
    "contacts.telegramDisableError": "Couldn't disconnect Telegram.",
    "contacts.whatsappLinked": "WhatsApp linked",
    "contacts.whatsappNotLinked": "WhatsApp not linked",
    "contacts.whatsappConnect": "Connect WhatsApp",
    "contacts.whatsappDisconnect": "Disconnect WhatsApp",
    "contacts.whatsappLinkReady": "WhatsApp link ready — copied, share it with your contact so they can opt in.",
    "contacts.whatsappEnabled": "WhatsApp enabled.",
    "contacts.whatsappDisconnected": "WhatsApp disconnected.",
    "contacts.whatsappEnableError": "Couldn't enable WhatsApp.",
    "contacts.whatsappDisableError": "Couldn't disable WhatsApp.",
    "profile.name": "Name",
    "profile.phone": "Phone",
    "profile.email": "Email",
    "profile.newPassword": "New password (optional)",
    "profile.newPasswordPlaceholder": "Leave blank to keep current password",
    "profile.currentPassword": "Current password",
    "profile.currentPasswordPlaceholder": "Enter to change email or password",
    "profile.currentPasswordHint": "Required only when changing your email or password.",
    "profile.currentPasswordRequired": "Enter your current password to change your email or password.",
    "profile.save": "Save Changes",
    "profile.logout": "Log Out",
    "profile.noChanges": "No changes to save.",
    "profile.updated": "Profile updated.",
    "profile.language": "Language",
    "profile.theme": "Theme",
    "profile.themeAuto": "Auto",
    "profile.themeLight": "Light",
    "profile.themeDark": "Dark",
    "profile.color": "App color",
    "profile.colorCustom": "Custom",
    "profile.help": "Help",
    "profile.about": "About",
    "info.back": "Back",
    "help.intro": "Everything you need to know to get the most out of Panic Button.",
    "help.section.account.title": "Creating your account",
    "help.section.account.body": "Register with your name, phone, email and a password. We'll send a confirmation link to your email — open it on this device to activate your account, then come back and log in.",
    "help.section.panic.title": "Sending a panic alert",
    "help.section.panic.body": "On the Home screen, press and hold the SOS button for about a second and a half — a ring fills around it as you hold, and releasing early cancels it. Once the hold completes, the app gets your current location and notifies every confirmed emergency contact by email and, for contacts who've linked it, Telegram.",
    "help.section.contacts.title": "Managing emergency contacts",
    "help.section.contacts.body": "On the Contacts tab, tap the + button to add someone, either by picking them from your phone's address book or entering their details manually. Tap any existing contact to edit their details, connect or disconnect Telegram, or remove them.",
    "help.section.channels.title": "Confirmed vs. pending contacts",
    "help.section.channels.body": "Adding a contact doesn't notify them automatically — each contact shows a mail icon and, where available, a Telegram icon; a lit icon means that channel is confirmed and will receive alerts, a dim one means it isn't yet. Email is confirmed by the contact clicking the link we send them; Telegram is confirmed the moment they open the link and press Start in the chat with our bot.",
    "help.section.profile.title": "Your profile",
    "help.section.profile.body": "Update your name, phone, email or password from the Profile tab. You can also change the app's language and accent color from there — both are saved only on this device.",
    "about.description": "Panic Button is a personal safety app: press and hold one button to share your location and alert your trusted emergency contacts by email and Telegram, the moment you need them most.",
    "about.developedBy": "Developed by Skellent",
    "about.rights": "© Keycodelogics. All rights reserved.",
    "about.version": "Version BETA"
  },
  es: {
    "nav.home": "Inicio",
    "nav.contacts": "Contactos",
    "nav.profile": "Perfil",
    "route.login.title": "Iniciar Sesión",
    "route.register.title": "Crear Cuenta",
    "route.contacts.title": "Contactos de Emergencia",
    "route.profile.title": "Mi Perfil",
    "route.about.title": "Acerca de",
    "route.help.title": "Ayuda",
    "errors.generic": "Algo salió mal. Inténtalo de nuevo.",
    "errors.network": "No se pudo conectar con el servidor. Revisa tu conexión.",
    "login.subtitle": "Inicia sesión para tener a tus contactos de emergencia a un toque de distancia.",
    "login.email": "Correo electrónico",
    "login.password": "Contraseña",
    "login.submit": "Iniciar Sesión",
    "login.switch": "¿No tienes una cuenta?",
    "login.switchLink": "Crea una",
    "register.subtitle": "Unos pocos datos y estarás listo para agregar tus contactos de emergencia.",
    "register.name": "Nombre completo",
    "register.phone": "Teléfono",
    "register.email": "Correo electrónico",
    "register.password": "Contraseña",
    "register.confirmPassword": "Confirmar contraseña",
    "register.submit": "Crear Cuenta",
    "register.switch": "¿Ya tienes una cuenta?",
    "register.switchLink": "Inicia sesión",
    "register.passwordMismatch": "Las contraseñas no coinciden.",
    "confirmMail.title": "Revisa tu correo",
    "confirmMail.subtitle": 'Enviamos un enlace de confirmación a<br /><span class="confirm-mail-email">{email}</span>. Ábrelo en este dispositivo para activar tu cuenta y luego vuelve a iniciar sesión.',
    "confirmMail.back": "Volver a Iniciar Sesión",
    "home.greeting": "Hola, {name}",
    "home.panicAria": "Mantén presionado para enviar una alerta de pánico",
    "home.idle": "Mantén presionado para alertar a tus contactos",
    "home.holding": "Sigue presionando para confirmar...",
    "home.locating": "Obteniendo tu ubicación...",
    "home.sending": "Enviando alerta...",
    "home.sent": "Alerta enviada — tus contactos están siendo notificados",
    "home.sentToast": "Alerta de pánico enviada con éxito.",
    "home.errorFallback": "No se pudo enviar la alerta.",
    "home.statusReady": "{count} contacto listo para ser alertado",
    "home.statusReadyPlural": "{count} contactos listos para ser alertados",
    "home.statusNone": "Aún no tienes contactos confirmados",
    "home.noContacts": "Aún no tienes contactos confirmados — agrega y confirma un contacto antes de enviar una alerta.",
    "contacts.empty": "Todavía no tienes contactos de emergencia. Toca el botón + para agregar a alguien que deba ser notificado cuando actives una alerta de pánico.",
    "contacts.loadError": "No se pudieron cargar tus contactos. Vuelve a intentarlo reabriendo esta pestaña.",
    "contacts.loadErrorToast": "No se pudieron cargar los contactos.",
    "contacts.limitReached": "Ya alcanzaste el límite de {max} contactos de emergencia.",
    "contacts.confirmed": "Confirmado",
    "contacts.pending": "Pendiente",
    "contacts.addTitle": "Agregar Contacto de Emergencia",
    "contacts.pickDevice": "Elegir de los contactos del dispositivo",
    "contacts.addManually": "Agregar manualmente",
    "contacts.editTitle": "Editar Contacto",
    "contacts.name": "Nombre",
    "contacts.phone": "Teléfono",
    "contacts.email": "Correo electrónico",
    "contacts.emailRequired": "Ingresá un correo electrónico para este contacto.",
    "contacts.emailHint": "Le enviaremos a este contacto un enlace de confirmación por correo — solo los contactos confirmados son notificados durante una alerta de pánico.",
    "contacts.save": "Guardar Cambios",
    "contacts.add": "Agregar Contacto",
    "contacts.delete": "Eliminar Contacto",
    "contacts.updated": "Contacto actualizado.",
    "contacts.addedWithEmail": "Contacto agregado — se envió el correo de confirmación.",
    "contacts.removed": "Contacto eliminado.",
    "contacts.removeError": "No se pudo eliminar el contacto.",
    "contacts.removeConfirm": "¿Quitar a {name} de tus contactos de emergencia?",
    "contacts.pickError": "No se pudo acceder a tus contactos.",
    "contacts.telegramLinked": "Telegram vinculado",
    "contacts.telegramNotLinked": "Telegram no vinculado",
    "contacts.resendConfirmation": "Reenviar correo de confirmación",
    "contacts.resendConfirmationSent": "Correo de confirmación reenviado.",
    "contacts.telegramConnect": "Conectar Telegram",
    "contacts.telegramDisconnect": "Desconectar Telegram",
    "contacts.telegramEmailSent": "Enlace de Telegram enviado a su correo.",
    "contacts.telegramLinkReady": "Enlace de Telegram listo — copiado, compártelo con tu contacto.",
    "contacts.telegramDisconnected": "Telegram desconectado.",
    "contacts.telegramEnableError": "No se pudo iniciar la vinculación de Telegram.",
    "contacts.telegramDisableError": "No se pudo desconectar Telegram.",
    "contacts.whatsappLinked": "WhatsApp vinculado",
    "contacts.whatsappNotLinked": "WhatsApp no vinculado",
    "contacts.whatsappConnect": "Conectar WhatsApp",
    "contacts.whatsappDisconnect": "Desconectar WhatsApp",
    "contacts.whatsappLinkReady": "Enlace de WhatsApp listo — copiado, compártelo con tu contacto para que se una.",
    "contacts.whatsappEnabled": "WhatsApp activado.",
    "contacts.whatsappDisconnected": "WhatsApp desconectado.",
    "contacts.whatsappEnableError": "No se pudo activar WhatsApp.",
    "contacts.whatsappDisableError": "No se pudo desactivar WhatsApp.",
    "profile.name": "Nombre",
    "profile.phone": "Teléfono",
    "profile.email": "Correo electrónico",
    "profile.newPassword": "Nueva contraseña (opcional)",
    "profile.newPasswordPlaceholder": "Déjalo en blanco para mantener tu contraseña actual",
    "profile.currentPassword": "Contraseña actual",
    "profile.currentPasswordPlaceholder": "Introdúcela para cambiar correo o contraseña",
    "profile.currentPasswordHint": "Solo se necesita al cambiar tu correo o contraseña.",
    "profile.currentPasswordRequired": "Introduce tu contraseña actual para cambiar tu correo o contraseña.",
    "profile.save": "Guardar Cambios",
    "profile.logout": "Cerrar Sesión",
    "profile.noChanges": "No hay cambios que guardar.",
    "profile.updated": "Perfil actualizado.",
    "profile.language": "Idioma",
    "profile.theme": "Tema",
    "profile.themeAuto": "Automático",
    "profile.themeLight": "Claro",
    "profile.themeDark": "Oscuro",
    "profile.color": "Color de la app",
    "profile.colorCustom": "Personalizado",
    "profile.help": "Ayuda",
    "profile.about": "Acerca de",
    "info.back": "Volver",
    "help.intro": "Todo lo que necesitás saber para aprovechar Panic Button al máximo.",
    "help.section.account.title": "Crear tu cuenta",
    "help.section.account.body": "Registrate con tu nombre, teléfono, correo y una contraseña. Te enviaremos un enlace de confirmación a tu correo — ábrelo en este dispositivo para activar tu cuenta y luego volvé a iniciar sesión.",
    "help.section.panic.title": "Enviar una alerta de pánico",
    "help.section.panic.body": "En la pantalla de Inicio, mantené presionado el botón SOS durante aproximadamente un segundo y medio — un anillo se completa alrededor del botón mientras lo mantenés presionado, y soltarlo antes lo cancela. Al completarse, la app obtiene tu ubicación actual y notifica a cada contacto de emergencia confirmado por correo y, para quienes hayan vinculado Telegram, también por ahí.",
    "help.section.contacts.title": "Gestionar contactos de emergencia",
    "help.section.contacts.body": "En la pestaña Contactos, tocá el botón + para agregar a alguien, ya sea eligiéndolo de la agenda de tu teléfono o ingresando sus datos manualmente. Tocá cualquier contacto existente para editar sus datos, conectar o desconectar Telegram, o eliminarlo.",
    "help.section.channels.title": "Contactos confirmados vs. pendientes",
    "help.section.channels.body": "Agregar un contacto no lo notifica automáticamente — cada contacto muestra un ícono de correo y, cuando está disponible, uno de Telegram; un ícono iluminado significa que ese canal está confirmado y recibirá alertas, uno apagado significa que todavía no. El correo se confirma cuando el contacto hace clic en el enlace que le enviamos; Telegram se confirma en el momento en que abre el enlace y presiona Iniciar en el chat con nuestro bot.",
    "help.section.profile.title": "Tu perfil",
    "help.section.profile.body": "Actualizá tu nombre, teléfono, correo o contraseña desde la pestaña Perfil. También podés cambiar el idioma y el color de la app desde ahí — ambos se guardan solo en este dispositivo.",
    "about.description": "Panic Button es una app de seguridad personal: mantené presionado un botón para compartir tu ubicación y alertar a tus contactos de confianza por correo y Telegram, en el momento en que más los necesitás.",
    "about.developedBy": "Desarrollado por Skellent",
    "about.rights": "© Keycodelogics. Todos los derechos reservados.",
    "about.version": "Versión BETA"
  },
  "pt-BR": {
    "nav.home": "Início",
    "nav.contacts": "Contatos",
    "nav.profile": "Perfil",
    "route.login.title": "Entrar",
    "route.register.title": "Criar Conta",
    "route.contacts.title": "Contatos de Emergência",
    "route.profile.title": "Meu Perfil",
    "route.about.title": "Sobre",
    "route.help.title": "Ajuda",
    "errors.generic": "Algo deu errado. Tente novamente.",
    "errors.network": "Não foi possível conectar ao servidor. Verifique sua conexão.",
    "login.subtitle": "Entre para ter seus contatos de emergência a um toque de distância.",
    "login.email": "E-mail",
    "login.password": "Senha",
    "login.submit": "Entrar",
    "login.switch": "Não tem uma conta?",
    "login.switchLink": "Criar uma",
    "register.subtitle": "Alguns dados e você já pode adicionar seus contatos de emergência.",
    "register.name": "Nome completo",
    "register.phone": "Telefone",
    "register.email": "E-mail",
    "register.password": "Senha",
    "register.confirmPassword": "Confirmar senha",
    "register.submit": "Criar Conta",
    "register.switch": "Já tem uma conta?",
    "register.switchLink": "Entrar",
    "register.passwordMismatch": "As senhas não coincidem.",
    "confirmMail.title": "Verifique seu e-mail",
    "confirmMail.subtitle": 'Enviamos um link de confirmação para<br /><span class="confirm-mail-email">{email}</span>. Abra-o neste dispositivo para ativar sua conta e depois volte para entrar.',
    "confirmMail.back": "Voltar para Entrar",
    "home.greeting": "Olá, {name}",
    "home.panicAria": "Mantenha pressionado para enviar um alerta de pânico",
    "home.idle": "Mantenha pressionado para alertar seus contatos",
    "home.holding": "Continue pressionando para confirmar...",
    "home.locating": "Obtendo sua localização...",
    "home.sending": "Enviando alerta...",
    "home.sent": "Alerta enviado — seus contatos estão sendo notificados",
    "home.sentToast": "Alerta de pânico enviado com sucesso.",
    "home.errorFallback": "Não foi possível enviar o alerta.",
    "home.statusReady": "{count} contato pronto para ser alertado",
    "home.statusReadyPlural": "{count} contatos prontos para serem alertados",
    "home.statusNone": "Ainda não há contatos confirmados",
    "contacts.empty": "Você ainda não tem contatos de emergência. Toque no botão + para adicionar alguém que deva ser notificado quando você acionar um alerta de pânico.",
    "contacts.loadError": "Não foi possível carregar seus contatos. Reabra esta aba para tentar novamente.",
    "contacts.loadErrorToast": "Não foi possível carregar os contatos.",
    "contacts.limitReached": "Você atingiu o limite de {max} contatos de emergência.",
    "contacts.confirmed": "Confirmado",
    "contacts.pending": "Pendente",
    "contacts.addTitle": "Adicionar Contato de Emergência",
    "contacts.pickDevice": "Escolher dos contatos do dispositivo",
    "contacts.addManually": "Adicionar manualmente",
    "contacts.editTitle": "Editar Contato",
    "contacts.name": "Nome",
    "contacts.phone": "Telefone",
    "contacts.email": "E-mail",
    "contacts.emailRequired": "Digite um e-mail para este contato.",
    "contacts.emailHint": "Enviaremos a este contato um link de confirmação por e-mail — apenas contatos confirmados são notificados durante um alerta de pânico.",
    "contacts.save": "Salvar Alterações",
    "contacts.add": "Adicionar Contato",
    "contacts.delete": "Excluir Contato",
    "contacts.updated": "Contato atualizado.",
    "contacts.addedWithEmail": "Contato adicionado — e-mail de confirmação enviado.",
    "contacts.removed": "Contato removido.",
    "contacts.removeError": "Não foi possível remover o contato.",
    "contacts.removeConfirm": "Remover {name} dos seus contatos de emergência?",
    "contacts.pickError": "Não foi possível acessar seus contatos.",
    "contacts.telegramLinked": "Telegram vinculado",
    "contacts.telegramNotLinked": "Telegram não vinculado",
    "contacts.telegramConnect": "Conectar Telegram",
    "contacts.telegramDisconnect": "Desconectar Telegram",
    "contacts.telegramEmailSent": "Link do Telegram enviado ao e-mail dele.",
    "contacts.telegramLinkReady": "Link do Telegram pronto — copiado, compartilhe com seu contato.",
    "contacts.telegramDisconnected": "Telegram desconectado.",
    "contacts.telegramEnableError": "Não foi possível iniciar a vinculação do Telegram.",
    "contacts.telegramDisableError": "Não foi possível desconectar o Telegram.",
    "profile.name": "Nome",
    "profile.phone": "Telefone",
    "profile.email": "E-mail",
    "profile.newPassword": "Nova senha (opcional)",
    "profile.newPasswordPlaceholder": "Deixe em branco para manter a senha atual",
    "profile.save": "Salvar Alterações",
    "profile.logout": "Sair",
    "profile.noChanges": "Não há alterações para salvar.",
    "profile.updated": "Perfil atualizado.",
    "profile.language": "Idioma",
    "profile.theme": "Tema",
    "profile.themeAuto": "Automático",
    "profile.themeLight": "Claro",
    "profile.themeDark": "Escuro",
    "profile.color": "Cor do app",
    "profile.colorCustom": "Personalizado",
    "profile.help": "Ajuda",
    "profile.about": "Sobre",
    "info.back": "Voltar",
    "help.intro": "Tudo o que você precisa saber para aproveitar ao máximo o Panic Button.",
    "help.section.account.title": "Criar sua conta",
    "help.section.account.body": "Registre-se com seu nome, telefone, e-mail e uma senha. Enviaremos um link de confirmação ao seu e-mail — abra-o neste dispositivo para ativar sua conta e depois volte para entrar.",
    "help.section.panic.title": "Enviar um alerta de pânico",
    "help.section.panic.body": "Na tela Início, mantenha pressionado o botão SOS por cerca de um segundo e meio — um anel se preenche ao redor do botão enquanto você o pressiona, e soltar antes cancela o envio. Ao completar, o app obtém sua localização atual e notifica cada contato de emergência confirmado por e-mail e, para quem vinculou o Telegram, também por lá.",
    "help.section.contacts.title": "Gerenciar contatos de emergência",
    "help.section.contacts.body": "Na aba Contatos, toque no botão + para adicionar alguém, escolhendo da agenda do seu telefone ou digitando os dados manualmente. Toque em qualquer contato existente para editar seus dados, conectar ou desconectar o Telegram, ou removê-lo.",
    "help.section.channels.title": "Contatos confirmados vs. pendentes",
    "help.section.channels.body": "Adicionar um contato não o notifica automaticamente — cada contato mostra um ícone de e-mail e, quando disponível, um de Telegram; um ícone aceso significa que aquele canal está confirmado e receberá alertas, um apagado significa que ainda não. O e-mail é confirmado quando o contato clica no link que enviamos; o Telegram é confirmado no momento em que ele abre o link e aperta Iniciar na conversa com nosso bot.",
    "help.section.profile.title": "Seu perfil",
    "help.section.profile.body": "Atualize seu nome, telefone, e-mail ou senha na aba Perfil. Você também pode mudar o idioma e a cor do app por lá — ambos são salvos apenas neste dispositivo.",
    "about.description": "Panic Button é um app de segurança pessoal: mantenha pressionado um botão para compartilhar sua localização e alertar seus contatos de confiança por e-mail e Telegram, no momento em que você mais precisar deles.",
    "about.developedBy": "Desenvolvido por Skellent",
    "about.rights": "© Keycodelogics. Todos os direitos reservados.",
    "about.version": "Versão BETA"
  },
  "pt-PT": {
    "nav.home": "Início",
    "nav.contacts": "Contactos",
    "nav.profile": "Perfil",
    "route.login.title": "Iniciar Sessão",
    "route.register.title": "Criar Conta",
    "route.contacts.title": "Contactos de Emergência",
    "route.profile.title": "O Meu Perfil",
    "route.about.title": "Sobre",
    "route.help.title": "Ajuda",
    "errors.generic": "Algo correu mal. Tenta novamente.",
    "errors.network": "Não foi possível ligar ao servidor. Verifica a tua ligação.",
    "login.subtitle": "Inicia sessão para teres os teus contactos de emergência a um toque de distância.",
    "login.email": "Correio eletrónico",
    "login.password": "Palavra-passe",
    "login.submit": "Iniciar Sessão",
    "login.switch": "Não tens conta?",
    "login.switchLink": "Cria uma",
    "register.subtitle": "Alguns dados e ficas pronto para adicionar os teus contactos de emergência.",
    "register.name": "Nome completo",
    "register.phone": "Telefone",
    "register.email": "Correio eletrónico",
    "register.password": "Palavra-passe",
    "register.confirmPassword": "Confirmar palavra-passe",
    "register.submit": "Criar Conta",
    "register.switch": "Já tens conta?",
    "register.switchLink": "Inicia sessão",
    "register.passwordMismatch": "As palavras-passe não coincidem.",
    "confirmMail.title": "Verifica o teu correio",
    "confirmMail.subtitle": 'Enviámos uma ligação de confirmação para<br /><span class="confirm-mail-email">{email}</span>. Abre-a neste dispositivo para ativares a tua conta e depois volta para iniciar sessão.',
    "confirmMail.back": "Voltar a Iniciar Sessão",
    "home.greeting": "Olá, {name}",
    "home.panicAria": "Mantém premido para enviar um alerta de pânico",
    "home.idle": "Mantém premido para alertar os teus contactos",
    "home.holding": "Continua a premir para confirmar...",
    "home.locating": "A obter a tua localização...",
    "home.sending": "A enviar alerta...",
    "home.sent": "Alerta enviado — os teus contactos estão a ser notificados",
    "home.sentToast": "Alerta de pânico enviado com sucesso.",
    "home.errorFallback": "Não foi possível enviar o alerta.",
    "home.statusReady": "{count} contacto pronto a ser alertado",
    "home.statusReadyPlural": "{count} contactos prontos a ser alertados",
    "home.statusNone": "Ainda não tens contactos confirmados",
    "contacts.empty": "Ainda não tens contactos de emergência. Toca no botão + para adicionares alguém que deva ser notificado quando ativares um alerta de pânico.",
    "contacts.loadError": "Não foi possível carregar os teus contactos. Reabre este separador para tentar novamente.",
    "contacts.loadErrorToast": "Não foi possível carregar os contactos.",
    "contacts.limitReached": "Atingiste o limite de {max} contactos de emergência.",
    "contacts.confirmed": "Confirmado",
    "contacts.pending": "Pendente",
    "contacts.addTitle": "Adicionar Contacto de Emergência",
    "contacts.pickDevice": "Escolher dos contactos do dispositivo",
    "contacts.addManually": "Adicionar manualmente",
    "contacts.editTitle": "Editar Contacto",
    "contacts.name": "Nome",
    "contacts.phone": "Telefone",
    "contacts.email": "Correio eletrónico",
    "contacts.emailRequired": "Indica um correio eletrónico para este contacto.",
    "contacts.emailHint": "Vamos enviar a este contacto uma ligação de confirmação por correio eletrónico — só os contactos confirmados são notificados durante um alerta de pânico.",
    "contacts.save": "Guardar Alterações",
    "contacts.add": "Adicionar Contacto",
    "contacts.delete": "Eliminar Contacto",
    "contacts.updated": "Contacto atualizado.",
    "contacts.addedWithEmail": "Contacto adicionado — correio de confirmação enviado.",
    "contacts.removed": "Contacto removido.",
    "contacts.removeError": "Não foi possível remover o contacto.",
    "contacts.removeConfirm": "Remover {name} dos teus contactos de emergência?",
    "contacts.pickError": "Não foi possível aceder aos teus contactos.",
    "contacts.telegramLinked": "Telegram associado",
    "contacts.telegramNotLinked": "Telegram não associado",
    "contacts.telegramConnect": "Associar Telegram",
    "contacts.telegramDisconnect": "Desassociar Telegram",
    "contacts.telegramEmailSent": "Ligação do Telegram enviada para o correio dele.",
    "contacts.telegramLinkReady": "Ligação do Telegram pronta — copiada, partilha-a com o teu contacto.",
    "contacts.telegramDisconnected": "Telegram desassociado.",
    "contacts.telegramEnableError": "Não foi possível iniciar a associação ao Telegram.",
    "contacts.telegramDisableError": "Não foi possível desassociar o Telegram.",
    "profile.name": "Nome",
    "profile.phone": "Telefone",
    "profile.email": "Correio eletrónico",
    "profile.newPassword": "Nova palavra-passe (opcional)",
    "profile.newPasswordPlaceholder": "Deixa em branco para manteres a palavra-passe atual",
    "profile.save": "Guardar Alterações",
    "profile.logout": "Terminar Sessão",
    "profile.noChanges": "Não há alterações para guardar.",
    "profile.updated": "Perfil atualizado.",
    "profile.language": "Idioma",
    "profile.theme": "Tema",
    "profile.themeAuto": "Automático",
    "profile.themeLight": "Claro",
    "profile.themeDark": "Escuro",
    "profile.color": "Cor da aplicação",
    "profile.colorCustom": "Personalizada",
    "profile.help": "Ajuda",
    "profile.about": "Sobre",
    "info.back": "Voltar",
    "help.intro": "Tudo o que precisas de saber para tirar o máximo partido da Panic Button.",
    "help.section.account.title": "Criar a tua conta",
    "help.section.account.body": "Regista-te com o teu nome, telefone, correio eletrónico e uma palavra-passe. Vamos enviar uma ligação de confirmação para o teu correio — abre-a neste dispositivo para ativares a conta e depois volta para iniciar sessão.",
    "help.section.panic.title": "Enviar um alerta de pânico",
    "help.section.panic.body": "No ecrã Início, mantém premido o botão SOS durante cerca de um segundo e meio — um anel preenche-se à volta do botão enquanto o premes, e soltá-lo antes cancela o envio. Ao completar-se, a aplicação obtém a tua localização atual e notifica cada contacto de emergência confirmado por correio eletrónico e, para quem associou o Telegram, também por aí.",
    "help.section.contacts.title": "Gerir contactos de emergência",
    "help.section.contacts.body": "No separador Contactos, toca no botão + para adicionares alguém, escolhendo dos contactos do teu telefone ou introduzindo os dados manualmente. Toca em qualquer contacto existente para editares os dados, associares ou desassociares o Telegram, ou o removeres.",
    "help.section.channels.title": "Contactos confirmados vs. pendentes",
    "help.section.channels.body": "Adicionar um contacto não o notifica automaticamente — cada contacto mostra um ícone de correio e, quando disponível, um do Telegram; um ícone aceso significa que esse canal está confirmado e vai receber alertas, um apagado significa que ainda não. O correio confirma-se quando o contacto clica na ligação que enviámos; o Telegram confirma-se no momento em que abre a ligação e prime Iniciar na conversa com o nosso bot.",
    "help.section.profile.title": "O teu perfil",
    "help.section.profile.body": "Atualiza o teu nome, telefone, correio eletrónico ou palavra-passe no separador Perfil. Também podes mudar o idioma e a cor da aplicação a partir daí — ambos ficam guardados só neste dispositivo.",
    "about.description": "Panic Button é uma aplicação de segurança pessoal: mantém premido um botão para partilhares a tua localização e alertares os teus contactos de confiança por correio eletrónico e Telegram, no momento em que mais precisares deles.",
    "about.developedBy": "Desenvolvido por Skellent",
    "about.rights": "© Keycodelogics. Todos os direitos reservados.",
    "about.version": "Versão BETA"
  },
  fr: {
    "nav.home": "Accueil",
    "nav.contacts": "Contacts",
    "nav.profile": "Profil",
    "route.login.title": "Connexion",
    "route.register.title": "Créer un compte",
    "route.contacts.title": "Contacts d'urgence",
    "route.profile.title": "Mon profil",
    "route.about.title": "À propos",
    "route.help.title": "Aide",
    "errors.generic": "Une erreur est survenue. Réessaie.",
    "errors.network": "Impossible de joindre le serveur. Vérifie ta connexion.",
    "login.subtitle": "Connecte-toi pour garder tes contacts d'urgence à portée de main.",
    "login.email": "E-mail",
    "login.password": "Mot de passe",
    "login.submit": "Se connecter",
    "login.switch": "Pas encore de compte ?",
    "login.switchLink": "En créer un",
    "register.subtitle": "Quelques informations et tu pourras ajouter tes contacts d'urgence.",
    "register.name": "Nom complet",
    "register.phone": "Téléphone",
    "register.email": "E-mail",
    "register.password": "Mot de passe",
    "register.confirmPassword": "Confirmer le mot de passe",
    "register.submit": "Créer un compte",
    "register.switch": "Déjà un compte ?",
    "register.switchLink": "Se connecter",
    "register.passwordMismatch": "Les mots de passe ne correspondent pas.",
    "confirmMail.title": "Vérifie tes e-mails",
    "confirmMail.subtitle": 'Nous avons envoyé un lien de confirmation à<br /><span class="confirm-mail-email">{email}</span>. Ouvre-le sur cet appareil pour activer ton compte, puis reviens te connecter.',
    "confirmMail.back": "Retour à la connexion",
    "home.greeting": "Salut, {name}",
    "home.panicAria": "Maintiens appuyé pour envoyer une alerte panique",
    "home.idle": "Maintiens appuyé pour alerter tes contacts",
    "home.holding": "Continue à appuyer pour confirmer...",
    "home.locating": "Récupération de ta position...",
    "home.sending": "Envoi de l'alerte...",
    "home.sent": "Alerte envoyée — tes contacts sont en train d'être prévenus",
    "home.sentToast": "Alerte panique envoyée avec succès.",
    "home.errorFallback": "Impossible d'envoyer l'alerte.",
    "home.statusReady": "{count} contact prêt à être alerté",
    "home.statusReadyPlural": "{count} contacts prêts à être alertés",
    "home.statusNone": "Aucun contact confirmé pour l'instant",
    "contacts.empty": "Tu n'as pas encore de contact d'urgence. Appuie sur le bouton + pour ajouter quelqu'un à prévenir quand tu déclenches une alerte panique.",
    "contacts.loadError": "Impossible de charger tes contacts. Rouvre cet onglet pour réessayer.",
    "contacts.loadErrorToast": "Impossible de charger les contacts.",
    "contacts.limitReached": "Tu as atteint la limite de {max} contacts d'urgence.",
    "contacts.confirmed": "Confirmé",
    "contacts.pending": "En attente",
    "contacts.addTitle": "Ajouter un contact d'urgence",
    "contacts.pickDevice": "Choisir parmi les contacts de l'appareil",
    "contacts.addManually": "Ajouter manuellement",
    "contacts.editTitle": "Modifier le contact",
    "contacts.name": "Nom",
    "contacts.phone": "Téléphone",
    "contacts.email": "E-mail",
    "contacts.emailRequired": "Indique un e-mail pour ce contact.",
    "contacts.emailHint": "Nous enverrons à ce contact un lien de confirmation par e-mail — seuls les contacts confirmés sont prévenus lors d'une alerte panique.",
    "contacts.save": "Enregistrer",
    "contacts.add": "Ajouter le contact",
    "contacts.delete": "Supprimer le contact",
    "contacts.updated": "Contact mis à jour.",
    "contacts.addedWithEmail": "Contact ajouté — e-mail de confirmation envoyé.",
    "contacts.removed": "Contact supprimé.",
    "contacts.removeError": "Impossible de supprimer le contact.",
    "contacts.removeConfirm": "Retirer {name} de tes contacts d'urgence ?",
    "contacts.pickError": "Impossible d'accéder à tes contacts.",
    "contacts.telegramLinked": "Telegram lié",
    "contacts.telegramNotLinked": "Telegram non lié",
    "contacts.telegramConnect": "Lier Telegram",
    "contacts.telegramDisconnect": "Délier Telegram",
    "contacts.telegramEmailSent": "Lien Telegram envoyé à son e-mail.",
    "contacts.telegramLinkReady": "Lien Telegram prêt — copié, partage-le avec ton contact.",
    "contacts.telegramDisconnected": "Telegram délié.",
    "contacts.telegramEnableError": "Impossible de démarrer la liaison Telegram.",
    "contacts.telegramDisableError": "Impossible de délier Telegram.",
    "profile.name": "Nom",
    "profile.phone": "Téléphone",
    "profile.email": "E-mail",
    "profile.newPassword": "Nouveau mot de passe (facultatif)",
    "profile.newPasswordPlaceholder": "Laisse vide pour garder ton mot de passe actuel",
    "profile.save": "Enregistrer",
    "profile.logout": "Se déconnecter",
    "profile.noChanges": "Aucune modification à enregistrer.",
    "profile.updated": "Profil mis à jour.",
    "profile.language": "Langue",
    "profile.theme": "Thème",
    "profile.themeAuto": "Auto",
    "profile.themeLight": "Clair",
    "profile.themeDark": "Sombre",
    "profile.color": "Couleur de l'application",
    "profile.colorCustom": "Personnalisée",
    "profile.help": "Aide",
    "profile.about": "À propos",
    "info.back": "Retour",
    "help.intro": "Tout ce qu'il faut savoir pour profiter au mieux de Panic Button.",
    "help.section.account.title": "Créer ton compte",
    "help.section.account.body": "Inscris-toi avec ton nom, ton téléphone, ton e-mail et un mot de passe. Nous t'enverrons un lien de confirmation par e-mail — ouvre-le sur cet appareil pour activer ton compte, puis reviens te connecter.",
    "help.section.panic.title": "Envoyer une alerte panique",
    "help.section.panic.body": "Sur l'écran d'accueil, maintiens appuyé le bouton SOS pendant environ une seconde et demie — un anneau se remplit autour du bouton pendant l'appui, et relâcher trop tôt annule l'envoi. Une fois l'appui terminé, l'application récupère ta position actuelle et prévient chaque contact d'urgence confirmé par e-mail et, pour ceux qui ont lié Telegram, également par ce biais.",
    "help.section.contacts.title": "Gérer tes contacts d'urgence",
    "help.section.contacts.body": "Dans l'onglet Contacts, appuie sur le bouton + pour ajouter quelqu'un, en le choisissant dans le carnet d'adresses de ton téléphone ou en saisissant ses informations manuellement. Appuie sur un contact existant pour modifier ses informations, lier ou délier Telegram, ou le supprimer.",
    "help.section.channels.title": "Contacts confirmés vs en attente",
    "help.section.channels.body": "Ajouter un contact ne le prévient pas automatiquement — chaque contact affiche une icône e-mail et, si disponible, une icône Telegram ; une icône allumée signifie que ce canal est confirmé et recevra les alertes, une icône éteinte signifie que ce n'est pas encore le cas. L'e-mail se confirme quand le contact clique sur le lien envoyé ; Telegram se confirme dès qu'il ouvre le lien et appuie sur Démarrer dans la conversation avec notre bot.",
    "help.section.profile.title": "Ton profil",
    "help.section.profile.body": "Mets à jour ton nom, ton téléphone, ton e-mail ou ton mot de passe depuis l'onglet Profil. Tu peux aussi y changer la langue et la couleur de l'application — les deux ne sont enregistrées que sur cet appareil.",
    "about.description": "Panic Button est une application de sécurité personnelle : maintiens appuyé un bouton pour partager ta position et alerter tes contacts de confiance par e-mail et Telegram, au moment où tu as le plus besoin d'eux.",
    "about.developedBy": "Développé par Skellent",
    "about.rights": "© Keycodelogics. Tous droits réservés.",
    "about.version": "Version BÊTA"
  },
  de: {
    "nav.home": "Start",
    "nav.contacts": "Kontakte",
    "nav.profile": "Profil",
    "route.login.title": "Anmelden",
    "route.register.title": "Konto erstellen",
    "route.contacts.title": "Notfallkontakte",
    "route.profile.title": "Mein Profil",
    "route.about.title": "Über",
    "route.help.title": "Hilfe",
    "errors.generic": "Etwas ist schiefgelaufen. Bitte versuch es erneut.",
    "errors.network": "Server nicht erreichbar. Überprüfe deine Verbindung.",
    "login.subtitle": "Melde dich an, damit deine Notfallkontakte nur einen Klick entfernt sind.",
    "login.email": "E-Mail",
    "login.password": "Passwort",
    "login.submit": "Anmelden",
    "login.switch": "Noch kein Konto?",
    "login.switchLink": "Jetzt erstellen",
    "register.subtitle": "Ein paar Angaben, und schon kannst du deine Notfallkontakte hinzufügen.",
    "register.name": "Vollständiger Name",
    "register.phone": "Telefon",
    "register.email": "E-Mail",
    "register.password": "Passwort",
    "register.confirmPassword": "Passwort bestätigen",
    "register.submit": "Konto erstellen",
    "register.switch": "Schon ein Konto?",
    "register.switchLink": "Anmelden",
    "register.passwordMismatch": "Die Passwörter stimmen nicht überein.",
    "confirmMail.title": "Überprüfe deine E-Mails",
    "confirmMail.subtitle": 'Wir haben einen Bestätigungslink an<br /><span class="confirm-mail-email">{email}</span> gesendet. Öffne ihn auf diesem Gerät, um dein Konto zu aktivieren, und melde dich danach an.',
    "confirmMail.back": "Zurück zur Anmeldung",
    "home.greeting": "Hallo, {name}",
    "home.panicAria": "Gedrückt halten, um einen Notfallalarm zu senden",
    "home.idle": "Gedrückt halten, um deine Kontakte zu alarmieren",
    "home.holding": "Weiter gedrückt halten, um zu bestätigen...",
    "home.locating": "Standort wird ermittelt...",
    "home.sending": "Alarm wird gesendet...",
    "home.sent": "Alarm gesendet — deine Kontakte werden benachrichtigt",
    "home.sentToast": "Notfallalarm erfolgreich gesendet.",
    "home.errorFallback": "Der Alarm konnte nicht gesendet werden.",
    "home.statusReady": "{count} Kontakt bereit, alarmiert zu werden",
    "home.statusReadyPlural": "{count} Kontakte bereit, alarmiert zu werden",
    "home.statusNone": "Noch keine bestätigten Kontakte",
    "contacts.empty": "Du hast noch keine Notfallkontakte. Tippe auf das +, um jemanden hinzuzufügen, der bei einem Notfallalarm benachrichtigt werden soll.",
    "contacts.loadError": "Deine Kontakte konnten nicht geladen werden. Öffne diesen Tab erneut, um es noch einmal zu versuchen.",
    "contacts.loadErrorToast": "Kontakte konnten nicht geladen werden.",
    "contacts.limitReached": "Du hast das Limit von {max} Notfallkontakten erreicht.",
    "contacts.confirmed": "Bestätigt",
    "contacts.pending": "Ausstehend",
    "contacts.addTitle": "Notfallkontakt hinzufügen",
    "contacts.pickDevice": "Aus den Gerätekontakten wählen",
    "contacts.addManually": "Manuell hinzufügen",
    "contacts.editTitle": "Kontakt bearbeiten",
    "contacts.name": "Name",
    "contacts.phone": "Telefon",
    "contacts.email": "E-Mail",
    "contacts.emailRequired": "Bitte gib eine E-Mail-Adresse für diesen Kontakt ein.",
    "contacts.emailHint": "Wir senden diesem Kontakt einen Bestätigungslink per E-Mail — nur bestätigte Kontakte werden bei einem Notfallalarm benachrichtigt.",
    "contacts.save": "Änderungen speichern",
    "contacts.add": "Kontakt hinzufügen",
    "contacts.delete": "Kontakt löschen",
    "contacts.updated": "Kontakt aktualisiert.",
    "contacts.addedWithEmail": "Kontakt hinzugefügt — Bestätigungs-E-Mail gesendet.",
    "contacts.removed": "Kontakt entfernt.",
    "contacts.removeError": "Kontakt konnte nicht entfernt werden.",
    "contacts.removeConfirm": "{name} aus deinen Notfallkontakten entfernen?",
    "contacts.pickError": "Auf deine Kontakte konnte nicht zugegriffen werden.",
    "contacts.telegramLinked": "Telegram verknüpft",
    "contacts.telegramNotLinked": "Telegram nicht verknüpft",
    "contacts.telegramConnect": "Telegram verknüpfen",
    "contacts.telegramDisconnect": "Telegram trennen",
    "contacts.telegramEmailSent": "Telegram-Link an seine E-Mail gesendet.",
    "contacts.telegramLinkReady": "Telegram-Link bereit — kopiert, teile ihn mit deinem Kontakt.",
    "contacts.telegramDisconnected": "Telegram getrennt.",
    "contacts.telegramEnableError": "Telegram-Verknüpfung konnte nicht gestartet werden.",
    "contacts.telegramDisableError": "Telegram konnte nicht getrennt werden.",
    "profile.name": "Name",
    "profile.phone": "Telefon",
    "profile.email": "E-Mail",
    "profile.newPassword": "Neues Passwort (optional)",
    "profile.newPasswordPlaceholder": "Leer lassen, um das aktuelle Passwort zu behalten",
    "profile.save": "Änderungen speichern",
    "profile.logout": "Abmelden",
    "profile.noChanges": "Keine Änderungen zum Speichern.",
    "profile.updated": "Profil aktualisiert.",
    "profile.language": "Sprache",
    "profile.theme": "Design",
    "profile.themeAuto": "Automatisch",
    "profile.themeLight": "Hell",
    "profile.themeDark": "Dunkel",
    "profile.color": "App-Farbe",
    "profile.colorCustom": "Benutzerdefiniert",
    "profile.help": "Hilfe",
    "profile.about": "Über",
    "info.back": "Zurück",
    "help.intro": "Alles, was du wissen musst, um Panic Button optimal zu nutzen.",
    "help.section.account.title": "Dein Konto erstellen",
    "help.section.account.body": "Registriere dich mit deinem Namen, deiner Telefonnummer, E-Mail-Adresse und einem Passwort. Wir senden dir einen Bestätigungslink per E-Mail — öffne ihn auf diesem Gerät, um dein Konto zu aktivieren, und melde dich danach an.",
    "help.section.panic.title": "Einen Notfallalarm senden",
    "help.section.panic.body": "Halte auf dem Startbildschirm den SOS-Button etwa anderthalb Sekunden gedrückt — während du ihn hältst, füllt sich ein Ring um den Button, und zu frühes Loslassen bricht den Vorgang ab. Sobald der Vorgang abgeschlossen ist, ermittelt die App deinen aktuellen Standort und benachrichtigt jeden bestätigten Notfallkontakt per E-Mail sowie, bei verknüpftem Telegram, zusätzlich darüber.",
    "help.section.contacts.title": "Notfallkontakte verwalten",
    "help.section.contacts.body": "Tippe im Tab Kontakte auf das +, um jemanden hinzuzufügen — entweder aus deinem Adressbuch ausgewählt oder manuell eingegeben. Tippe auf einen bestehenden Kontakt, um seine Daten zu bearbeiten, Telegram zu verknüpfen oder zu trennen, oder ihn zu entfernen.",
    "help.section.channels.title": "Bestätigte vs. ausstehende Kontakte",
    "help.section.channels.body": "Das Hinzufügen eines Kontakts benachrichtigt ihn nicht automatisch — jeder Kontakt zeigt ein E-Mail-Symbol und, falls verfügbar, ein Telegram-Symbol; ein leuchtendes Symbol bedeutet, dass dieser Kanal bestätigt ist und Alarme erhält, ein blasses bedeutet, dass es noch nicht so weit ist. E-Mail wird bestätigt, sobald der Kontakt auf den gesendeten Link klickt; Telegram wird bestätigt, sobald er den Link öffnet und im Chat mit unserem Bot auf Start tippt.",
    "help.section.profile.title": "Dein Profil",
    "help.section.profile.body": "Aktualisiere deinen Namen, deine Telefonnummer, E-Mail-Adresse oder dein Passwort im Tab Profil. Dort kannst du auch die Sprache und die Farbe der App ändern — beides wird nur auf diesem Gerät gespeichert.",
    "about.description": "Panic Button ist eine App für persönliche Sicherheit: Halte einen Button gedrückt, um deinen Standort zu teilen und deine vertrauten Notfallkontakte per E-Mail und Telegram zu alarmieren — genau dann, wenn du sie am meisten brauchst.",
    "about.developedBy": "Entwickelt von Skellent",
    "about.rights": "© Keycodelogics. Alle Rechte vorbehalten.",
    "about.version": "Version BETA"
  },
  it: {
    "nav.home": "Home",
    "nav.contacts": "Contatti",
    "nav.profile": "Profilo",
    "route.login.title": "Accedi",
    "route.register.title": "Crea account",
    "route.contacts.title": "Contatti di emergenza",
    "route.profile.title": "Il mio profilo",
    "route.about.title": "Informazioni",
    "route.help.title": "Aiuto",
    "errors.generic": "Qualcosa è andato storto. Riprova.",
    "errors.network": "Impossibile raggiungere il server. Controlla la connessione.",
    "login.subtitle": "Accedi per avere i tuoi contatti di emergenza a portata di tocco.",
    "login.email": "E-mail",
    "login.password": "Password",
    "login.submit": "Accedi",
    "login.switch": "Non hai un account?",
    "login.switchLink": "Creane uno",
    "register.subtitle": "Pochi dati e sarai pronto ad aggiungere i tuoi contatti di emergenza.",
    "register.name": "Nome completo",
    "register.phone": "Telefono",
    "register.email": "E-mail",
    "register.password": "Password",
    "register.confirmPassword": "Conferma password",
    "register.submit": "Crea account",
    "register.switch": "Hai già un account?",
    "register.switchLink": "Accedi",
    "register.passwordMismatch": "Le password non coincidono.",
    "confirmMail.title": "Controlla la tua e-mail",
    "confirmMail.subtitle": 'Abbiamo inviato un link di conferma a<br /><span class="confirm-mail-email">{email}</span>. Aprilo su questo dispositivo per attivare il tuo account, poi torna ad accedere.',
    "confirmMail.back": "Torna al login",
    "home.greeting": "Ciao, {name}",
    "home.panicAria": "Tieni premuto per inviare un allarme di emergenza",
    "home.idle": "Tieni premuto per allertare i tuoi contatti",
    "home.holding": "Continua a tenere premuto per confermare...",
    "home.locating": "Rilevamento della posizione...",
    "home.sending": "Invio dell'allarme...",
    "home.sent": "Allarme inviato — i tuoi contatti stanno per essere avvisati",
    "home.sentToast": "Allarme di emergenza inviato con successo.",
    "home.errorFallback": "Impossibile inviare l'allarme.",
    "home.statusReady": "{count} contatto pronto a essere allertato",
    "home.statusReadyPlural": "{count} contatti pronti a essere allertati",
    "home.statusNone": "Nessun contatto confermato per ora",
    "contacts.empty": "Non hai ancora contatti di emergenza. Tocca il pulsante + per aggiungere qualcuno da avvisare quando attivi un allarme di emergenza.",
    "contacts.loadError": "Impossibile caricare i tuoi contatti. Riapri questa scheda per riprovare.",
    "contacts.loadErrorToast": "Impossibile caricare i contatti.",
    "contacts.limitReached": "Hai raggiunto il limite di {max} contatti di emergenza.",
    "contacts.confirmed": "Confermato",
    "contacts.pending": "In attesa",
    "contacts.addTitle": "Aggiungi contatto di emergenza",
    "contacts.pickDevice": "Scegli dai contatti del dispositivo",
    "contacts.addManually": "Aggiungi manualmente",
    "contacts.editTitle": "Modifica contatto",
    "contacts.name": "Nome",
    "contacts.phone": "Telefono",
    "contacts.email": "E-mail",
    "contacts.emailRequired": "Inserisci un'e-mail per questo contatto.",
    "contacts.emailHint": "Invieremo a questo contatto un link di conferma via e-mail — solo i contatti confermati vengono avvisati durante un allarme di emergenza.",
    "contacts.save": "Salva modifiche",
    "contacts.add": "Aggiungi contatto",
    "contacts.delete": "Elimina contatto",
    "contacts.updated": "Contatto aggiornato.",
    "contacts.addedWithEmail": "Contatto aggiunto — e-mail di conferma inviata.",
    "contacts.removed": "Contatto rimosso.",
    "contacts.removeError": "Impossibile rimuovere il contatto.",
    "contacts.removeConfirm": "Rimuovere {name} dai tuoi contatti di emergenza?",
    "contacts.pickError": "Impossibile accedere ai tuoi contatti.",
    "contacts.telegramLinked": "Telegram collegato",
    "contacts.telegramNotLinked": "Telegram non collegato",
    "contacts.telegramConnect": "Collega Telegram",
    "contacts.telegramDisconnect": "Scollega Telegram",
    "contacts.telegramEmailSent": "Link di Telegram inviato alla sua e-mail.",
    "contacts.telegramLinkReady": "Link di Telegram pronto — copiato, condividilo con il tuo contatto.",
    "contacts.telegramDisconnected": "Telegram scollegato.",
    "contacts.telegramEnableError": "Impossibile avviare il collegamento a Telegram.",
    "contacts.telegramDisableError": "Impossibile scollegare Telegram.",
    "profile.name": "Nome",
    "profile.phone": "Telefono",
    "profile.email": "E-mail",
    "profile.newPassword": "Nuova password (facoltativa)",
    "profile.newPasswordPlaceholder": "Lascia vuoto per mantenere la password attuale",
    "profile.save": "Salva modifiche",
    "profile.logout": "Esci",
    "profile.noChanges": "Nessuna modifica da salvare.",
    "profile.updated": "Profilo aggiornato.",
    "profile.language": "Lingua",
    "profile.theme": "Tema",
    "profile.themeAuto": "Automatico",
    "profile.themeLight": "Chiaro",
    "profile.themeDark": "Scuro",
    "profile.color": "Colore dell'app",
    "profile.colorCustom": "Personalizzato",
    "profile.help": "Aiuto",
    "profile.about": "Informazioni",
    "info.back": "Indietro",
    "help.intro": "Tutto quello che devi sapere per sfruttare al meglio Panic Button.",
    "help.section.account.title": "Creare il tuo account",
    "help.section.account.body": "Registrati con nome, telefono, e-mail e una password. Ti invieremo un link di conferma via e-mail — aprilo su questo dispositivo per attivare l'account, poi torna ad accedere.",
    "help.section.panic.title": "Inviare un allarme di emergenza",
    "help.section.panic.body": "Nella schermata Home, tieni premuto il pulsante SOS per circa un secondo e mezzo — un anello si riempie intorno al pulsante mentre lo tieni premuto, e rilasciarlo prima annulla l'invio. Al termine, l'app rileva la tua posizione attuale e avvisa ogni contatto di emergenza confermato via e-mail e, per chi ha collegato Telegram, anche lì.",
    "help.section.contacts.title": "Gestire i contatti di emergenza",
    "help.section.contacts.body": "Nella scheda Contatti, tocca il pulsante + per aggiungere qualcuno, scegliendolo dalla rubrica del telefono o inserendo i dati manualmente. Tocca un contatto esistente per modificarne i dati, collegare o scollegare Telegram, oppure rimuoverlo.",
    "help.section.channels.title": "Contatti confermati e in attesa",
    "help.section.channels.body": "Aggiungere un contatto non lo avvisa automaticamente — ogni contatto mostra un'icona e-mail e, quando disponibile, una di Telegram; un'icona accesa significa che quel canale è confermato e riceverà gli allarmi, una spenta significa che non lo è ancora. L'e-mail si conferma quando il contatto clicca sul link inviato; Telegram si conferma nel momento in cui apre il link e preme Start nella chat con il nostro bot.",
    "help.section.profile.title": "Il tuo profilo",
    "help.section.profile.body": "Aggiorna nome, telefono, e-mail o password dalla scheda Profilo. Da lì puoi anche cambiare la lingua e il colore dell'app — entrambi vengono salvati solo su questo dispositivo.",
    "about.description": "Panic Button è un'app per la sicurezza personale: tieni premuto un pulsante per condividere la tua posizione e allertare i tuoi contatti di fiducia via e-mail e Telegram, proprio nel momento in cui ne hai più bisogno.",
    "about.developedBy": "Sviluppato da Skellent",
    "about.rights": "© Keycodelogics. Tutti i diritti riservati.",
    "about.version": "Versione BETA"
  },
  ru: {
    "nav.home": "Главная",
    "nav.contacts": "Контакты",
    "nav.profile": "Профиль",
    "route.login.title": "Вход",
    "route.register.title": "Создать аккаунт",
    "route.contacts.title": "Контакты для экстренной связи",
    "route.profile.title": "Мой профиль",
    "route.about.title": "О приложении",
    "route.help.title": "Помощь",
    "errors.generic": "Что-то пошло не так. Попробуй ещё раз.",
    "errors.network": "Не удалось подключиться к серверу. Проверь соединение.",
    "login.subtitle": "Войди, чтобы твои экстренные контакты были всегда под рукой.",
    "login.email": "Эл. почта",
    "login.password": "Пароль",
    "login.submit": "Войти",
    "login.switch": "Нет аккаунта?",
    "login.switchLink": "Создать",
    "register.subtitle": "Немного данных — и можно добавлять экстренные контакты.",
    "register.name": "Полное имя",
    "register.phone": "Телефон",
    "register.email": "Эл. почта",
    "register.password": "Пароль",
    "register.confirmPassword": "Подтвердите пароль",
    "register.submit": "Создать аккаунт",
    "register.switch": "Уже есть аккаунт?",
    "register.switchLink": "Войти",
    "register.passwordMismatch": "Пароли не совпадают.",
    "confirmMail.title": "Проверь почту",
    "confirmMail.subtitle": 'Мы отправили ссылку для подтверждения на<br /><span class="confirm-mail-email">{email}</span>. Открой её на этом устройстве, чтобы активировать аккаунт, а затем вернись и войди.',
    "confirmMail.back": "Назад ко входу",
    "home.greeting": "Привет, {name}",
    "home.panicAria": "Удерживай, чтобы отправить сигнал тревоги",
    "home.idle": "Удерживай, чтобы оповестить контакты",
    "home.holding": "Продолжай удерживать для подтверждения...",
    "home.locating": "Определяем твоё местоположение...",
    "home.sending": "Отправка сигнала...",
    "home.sent": "Сигнал отправлен — твои контакты уведомляются",
    "home.sentToast": "Сигнал тревоги успешно отправлен.",
    "home.errorFallback": "Не удалось отправить сигнал.",
    "home.statusReady": "{count} контакт готов получить оповещение",
    "home.statusReadyPlural": "{count} контактов готовы получить оповещение",
    "home.statusNone": "Пока нет подтверждённых контактов",
    "contacts.empty": "У тебя пока нет экстренных контактов. Нажми +, чтобы добавить того, кого нужно оповещать при сигнале тревоги.",
    "contacts.loadError": "Не удалось загрузить контакты. Открой вкладку заново, чтобы повторить попытку.",
    "contacts.loadErrorToast": "Не удалось загрузить контакты.",
    "contacts.limitReached": "Достигнут лимит в {max} экстренных контакта.",
    "contacts.confirmed": "Подтверждён",
    "contacts.pending": "Ожидает",
    "contacts.addTitle": "Добавить экстренный контакт",
    "contacts.pickDevice": "Выбрать из контактов устройства",
    "contacts.addManually": "Добавить вручную",
    "contacts.editTitle": "Изменить контакт",
    "contacts.name": "Имя",
    "contacts.phone": "Телефон",
    "contacts.email": "Эл. почта",
    "contacts.emailRequired": "Укажи адрес эл. почты для этого контакта.",
    "contacts.emailHint": "Мы отправим этому контакту ссылку для подтверждения по эл. почте — оповещения при сигнале тревоги получают только подтверждённые контакты.",
    "contacts.save": "Сохранить изменения",
    "contacts.add": "Добавить контакт",
    "contacts.delete": "Удалить контакт",
    "contacts.updated": "Контакт обновлён.",
    "contacts.addedWithEmail": "Контакт добавлен — письмо с подтверждением отправлено.",
    "contacts.removed": "Контакт удалён.",
    "contacts.removeError": "Не удалось удалить контакт.",
    "contacts.removeConfirm": "Удалить {name} из экстренных контактов?",
    "contacts.pickError": "Не удалось получить доступ к контактам.",
    "contacts.telegramLinked": "Telegram привязан",
    "contacts.telegramNotLinked": "Telegram не привязан",
    "contacts.telegramConnect": "Привязать Telegram",
    "contacts.telegramDisconnect": "Отвязать Telegram",
    "contacts.telegramEmailSent": "Ссылка на Telegram отправлена на его почту.",
    "contacts.telegramLinkReady": "Ссылка на Telegram готова — скопирована, поделись ею с контактом.",
    "contacts.telegramDisconnected": "Telegram отвязан.",
    "contacts.telegramEnableError": "Не удалось начать привязку Telegram.",
    "contacts.telegramDisableError": "Не удалось отвязать Telegram.",
    "profile.name": "Имя",
    "profile.phone": "Телефон",
    "profile.email": "Эл. почта",
    "profile.newPassword": "Новый пароль (необязательно)",
    "profile.newPasswordPlaceholder": "Оставь пустым, чтобы сохранить текущий пароль",
    "profile.save": "Сохранить изменения",
    "profile.logout": "Выйти",
    "profile.noChanges": "Нет изменений для сохранения.",
    "profile.updated": "Профиль обновлён.",
    "profile.language": "Язык",
    "profile.theme": "Тема",
    "profile.themeAuto": "Авто",
    "profile.themeLight": "Светлая",
    "profile.themeDark": "Тёмная",
    "profile.color": "Цвет приложения",
    "profile.colorCustom": "Свой цвет",
    "profile.help": "Помощь",
    "profile.about": "О приложении",
    "info.back": "Назад",
    "help.intro": "Всё, что нужно знать, чтобы использовать Panic Button по максимуму.",
    "help.section.account.title": "Создание аккаунта",
    "help.section.account.body": "Зарегистрируйся, указав имя, телефон, эл. почту и пароль. Мы отправим ссылку для подтверждения на почту — открой её на этом устройстве, чтобы активировать аккаунт, а затем войди.",
    "help.section.panic.title": "Отправка сигнала тревоги",
    "help.section.panic.body": "На главном экране удерживай кнопку SOS около полутора секунд — вокруг кнопки заполняется кольцо, пока ты её удерживаешь, а отпускание раньше времени отменяет отправку. По завершении приложение определяет твоё текущее местоположение и оповещает каждый подтверждённый экстренный контакт по эл. почте, а тех, кто привязал Telegram, — ещё и там.",
    "help.section.contacts.title": "Управление экстренными контактами",
    "help.section.contacts.body": "На вкладке «Контакты» нажми +, чтобы добавить человека — выбрав его из адресной книги телефона или введя данные вручную. Нажми на существующий контакт, чтобы изменить его данные, привязать или отвязать Telegram, либо удалить его.",
    "help.section.channels.title": "Подтверждённые и ожидающие контакты",
    "help.section.channels.body": "Добавление контакта не оповещает его автоматически — у каждого контакта есть значок почты и, если доступно, значок Telegram; горящий значок означает, что этот канал подтверждён и будет получать оповещения, а тусклый — что пока нет. Почта подтверждается, когда контакт переходит по отправленной ссылке; Telegram подтверждается, как только он открывает ссылку и нажимает «Старт» в чате с нашим ботом.",
    "help.section.profile.title": "Твой профиль",
    "help.section.profile.body": "Обнови имя, телефон, эл. почту или пароль на вкладке «Профиль». Там же можно изменить язык и цвет приложения — оба параметра сохраняются только на этом устройстве.",
    "about.description": "Panic Button — приложение для личной безопасности: удерживай кнопку, чтобы поделиться своим местоположением и оповестить доверенные экстренные контакты по эл. почте и Telegram именно тогда, когда они нужны тебе больше всего.",
    "about.developedBy": "Разработано Skellent",
    "about.rights": "© Keycodelogics. Все права защищены.",
    "about.version": "Версия БЕТА"
  },
  zh: {
    "nav.home": "首页",
    "nav.contacts": "联系人",
    "nav.profile": "我的",
    "route.login.title": "登录",
    "route.register.title": "创建账户",
    "route.contacts.title": "紧急联系人",
    "route.profile.title": "我的资料",
    "route.about.title": "关于",
    "route.help.title": "帮助",
    "errors.generic": "出了点问题，请重试。",
    "errors.network": "无法连接服务器，请检查网络连接。",
    "login.subtitle": "登录后即可随时联系你的紧急联系人。",
    "login.email": "邮箱",
    "login.password": "密码",
    "login.submit": "登录",
    "login.switch": "还没有账户？",
    "login.switchLink": "立即创建",
    "register.subtitle": "填写几项信息，即可添加你的紧急联系人。",
    "register.name": "姓名",
    "register.phone": "电话",
    "register.email": "邮箱",
    "register.password": "密码",
    "register.confirmPassword": "确认密码",
    "register.submit": "创建账户",
    "register.switch": "已有账户？",
    "register.switchLink": "去登录",
    "register.passwordMismatch": "两次输入的密码不一致。",
    "confirmMail.title": "请查收邮件",
    "confirmMail.subtitle": '我们已将确认链接发送至<br /><span class="confirm-mail-email">{email}</span>。请在本设备上打开该链接以激活账户，然后返回登录。',
    "confirmMail.back": "返回登录",
    "home.greeting": "你好，{name}",
    "home.panicAria": "长按发送紧急警报",
    "home.idle": "长按以提醒你的联系人",
    "home.holding": "继续按住以确认……",
    "home.locating": "正在获取你的位置……",
    "home.sending": "正在发送警报……",
    "home.sent": "警报已发送 — 正在通知你的联系人",
    "home.sentToast": "紧急警报发送成功。",
    "home.errorFallback": "警报发送失败。",
    "home.statusReady": "{count} 位联系人可接收警报",
    "home.statusReadyPlural": "{count} 位联系人可接收警报",
    "home.statusNone": "暂无已确认的联系人",
    "contacts.empty": "你还没有添加紧急联系人。点击 + 按钮添加一位在你触发紧急警报时应被通知的人。",
    "contacts.loadError": "无法加载你的联系人，请重新打开此页面重试。",
    "contacts.loadErrorToast": "无法加载联系人。",
    "contacts.limitReached": "已达到 {max} 位紧急联系人的上限。",
    "contacts.confirmed": "已确认",
    "contacts.pending": "待确认",
    "contacts.addTitle": "添加紧急联系人",
    "contacts.pickDevice": "从设备通讯录选择",
    "contacts.addManually": "手动添加",
    "contacts.editTitle": "编辑联系人",
    "contacts.name": "姓名",
    "contacts.phone": "电话",
    "contacts.email": "邮箱",
    "contacts.emailRequired": "请输入该联系人的邮箱地址。",
    "contacts.emailHint": "我们会向该联系人发送一封确认邮件 — 只有已确认的联系人才会在紧急警报时收到通知。",
    "contacts.save": "保存更改",
    "contacts.add": "添加联系人",
    "contacts.delete": "删除联系人",
    "contacts.updated": "联系人已更新。",
    "contacts.addedWithEmail": "联系人已添加 — 确认邮件已发送。",
    "contacts.removed": "联系人已删除。",
    "contacts.removeError": "无法删除该联系人。",
    "contacts.removeConfirm": "确定要将 {name} 从你的紧急联系人中移除吗？",
    "contacts.pickError": "无法访问你的通讯录。",
    "contacts.telegramLinked": "已绑定 Telegram",
    "contacts.telegramNotLinked": "未绑定 Telegram",
    "contacts.telegramConnect": "绑定 Telegram",
    "contacts.telegramDisconnect": "解绑 Telegram",
    "contacts.telegramEmailSent": "Telegram 链接已发送至其邮箱。",
    "contacts.telegramLinkReady": "Telegram 链接已生成并复制，请分享给你的联系人。",
    "contacts.telegramDisconnected": "已解绑 Telegram。",
    "contacts.telegramEnableError": "无法发起 Telegram 绑定。",
    "contacts.telegramDisableError": "无法解绑 Telegram。",
    "profile.name": "姓名",
    "profile.phone": "电话",
    "profile.email": "邮箱",
    "profile.newPassword": "新密码（选填）",
    "profile.newPasswordPlaceholder": "留空则保持当前密码不变",
    "profile.save": "保存更改",
    "profile.logout": "退出登录",
    "profile.noChanges": "没有需要保存的更改。",
    "profile.updated": "资料已更新。",
    "profile.language": "语言",
    "profile.theme": "主题",
    "profile.themeAuto": "自动",
    "profile.themeLight": "浅色",
    "profile.themeDark": "深色",
    "profile.color": "应用主题色",
    "profile.colorCustom": "自定义",
    "profile.help": "帮助",
    "profile.about": "关于",
    "info.back": "返回",
    "help.intro": "充分使用 Panic Button 所需了解的一切。",
    "help.section.account.title": "创建账户",
    "help.section.account.body": "使用你的姓名、电话、邮箱和密码注册。我们会向你的邮箱发送确认链接 — 请在本设备上打开以激活账户，然后返回登录。",
    "help.section.panic.title": "发送紧急警报",
    "help.section.panic.body": "在首页长按 SOS 按钮约一秒半 — 按住时按钮周围会出现一个逐渐填满的圆环，提前松开则取消发送。按住完成后，应用会获取你当前的位置，并通过邮件通知每一位已确认的紧急联系人；对于已绑定 Telegram 的联系人，还会通过 Telegram 通知。",
    "help.section.contacts.title": "管理紧急联系人",
    "help.section.contacts.body": "在联系人页面，点击 + 按钮添加联系人 — 可以从手机通讯录中选择，也可以手动输入信息。点击已有联系人可编辑其信息、绑定或解绑 Telegram，或将其移除。",
    "help.section.channels.title": "已确认与待确认的联系人",
    "help.section.channels.body": "添加联系人并不会自动通知对方 — 每位联系人会显示一个邮件图标，以及（若可用）一个 Telegram 图标；图标点亮表示该渠道已确认、将会收到警报，图标暗淡则表示尚未确认。联系人点击我们发送的链接即可确认邮件；打开链接并在与我们机器人的对话中点击“开始”即可确认 Telegram。",
    "help.section.profile.title": "你的资料",
    "help.section.profile.body": "在“我的”页面更新你的姓名、电话、邮箱或密码。你也可以在那里更改应用的语言和主题色 — 这两项设置仅保存在本设备上。",
    "about.description": "Panic Button 是一款个人安全应用：长按一个按钮即可分享你的位置，并在你最需要的时刻，通过邮件和 Telegram 提醒你信任的紧急联系人。",
    "about.developedBy": "由 Skellent 开发",
    "about.rights": "© Keycodelogics 保留所有权利。",
    "about.version": "测试版（BETA）"
  },
  ja: {
    "nav.home": "ホーム",
    "nav.contacts": "連絡先",
    "nav.profile": "プロフィール",
    "route.login.title": "ログイン",
    "route.register.title": "アカウント作成",
    "route.contacts.title": "緊急連絡先",
    "route.profile.title": "マイプロフィール",
    "route.about.title": "アプリについて",
    "route.help.title": "ヘルプ",
    "errors.generic": "問題が発生しました。もう一度お試しください。",
    "errors.network": "サーバーに接続できません。通信環境をご確認ください。",
    "login.subtitle": "ログインして、緊急連絡先にいつでもすぐ連絡できるようにしましょう。",
    "login.email": "メールアドレス",
    "login.password": "パスワード",
    "login.submit": "ログイン",
    "login.switch": "アカウントをお持ちでないですか？",
    "login.switchLink": "作成する",
    "register.subtitle": "いくつかの情報を入力すれば、緊急連絡先を追加できます。",
    "register.name": "氏名",
    "register.phone": "電話番号",
    "register.email": "メールアドレス",
    "register.password": "パスワード",
    "register.confirmPassword": "パスワード（確認）",
    "register.submit": "アカウントを作成",
    "register.switch": "すでにアカウントをお持ちですか？",
    "register.switchLink": "ログイン",
    "register.passwordMismatch": "パスワードが一致しません。",
    "confirmMail.title": "メールをご確認ください",
    "confirmMail.subtitle": '確認リンクを<br /><span class="confirm-mail-email">{email}</span> 宛に送信しました。このデバイスで開いてアカウントを有効化し、その後ログインしてください。',
    "confirmMail.back": "ログイン画面に戻る",
    "home.greeting": "こんにちは、{name}さん",
    "home.panicAria": "長押しして緊急通報を送信",
    "home.idle": "長押しして連絡先に通報",
    "home.holding": "確定するにはそのまま押し続けてください…",
    "home.locating": "現在地を取得しています…",
    "home.sending": "通報を送信しています…",
    "home.sent": "通報を送信しました — 連絡先に通知しています",
    "home.sentToast": "緊急通報を送信しました。",
    "home.errorFallback": "通報を送信できませんでした。",
    "home.statusReady": "通報可能な連絡先：{count}件",
    "home.statusReadyPlural": "通報可能な連絡先：{count}件",
    "home.statusNone": "確認済みの連絡先がまだありません",
    "contacts.empty": "緊急連絡先がまだ登録されていません。＋ボタンをタップして、緊急通報時に通知したい相手を追加しましょう。",
    "contacts.loadError": "連絡先を読み込めませんでした。このタブを開き直して再試行してください。",
    "contacts.loadErrorToast": "連絡先を読み込めませんでした。",
    "contacts.limitReached": "緊急連絡先の上限（{max}件）に達しました。",
    "contacts.confirmed": "確認済み",
    "contacts.pending": "未確認",
    "contacts.addTitle": "緊急連絡先を追加",
    "contacts.pickDevice": "端末の連絡先から選択",
    "contacts.addManually": "手動で追加",
    "contacts.editTitle": "連絡先を編集",
    "contacts.name": "名前",
    "contacts.phone": "電話番号",
    "contacts.email": "メールアドレス",
    "contacts.emailRequired": "この連絡先のメールアドレスを入力してください。",
    "contacts.emailHint": "この連絡先にメールで確認リンクを送信します — 緊急通報の通知は確認済みの連絡先にのみ届きます。",
    "contacts.save": "変更を保存",
    "contacts.add": "連絡先を追加",
    "contacts.delete": "連絡先を削除",
    "contacts.updated": "連絡先を更新しました。",
    "contacts.addedWithEmail": "連絡先を追加しました — 確認メールを送信しました。",
    "contacts.removed": "連絡先を削除しました。",
    "contacts.removeError": "連絡先を削除できませんでした。",
    "contacts.removeConfirm": "{name}さんを緊急連絡先から削除しますか？",
    "contacts.pickError": "連絡先にアクセスできませんでした。",
    "contacts.telegramLinked": "Telegram連携済み",
    "contacts.telegramNotLinked": "Telegram未連携",
    "contacts.telegramConnect": "Telegramと連携",
    "contacts.telegramDisconnect": "Telegram連携を解除",
    "contacts.telegramEmailSent": "Telegramのリンクを相手のメールに送信しました。",
    "contacts.telegramLinkReady": "Telegramのリンクをコピーしました — 連絡先の相手に共有してください。",
    "contacts.telegramDisconnected": "Telegram連携を解除しました。",
    "contacts.telegramEnableError": "Telegram連携を開始できませんでした。",
    "contacts.telegramDisableError": "Telegram連携を解除できませんでした。",
    "profile.name": "名前",
    "profile.phone": "電話番号",
    "profile.email": "メールアドレス",
    "profile.newPassword": "新しいパスワード（任意）",
    "profile.newPasswordPlaceholder": "変更しない場合は空欄のままにしてください",
    "profile.save": "変更を保存",
    "profile.logout": "ログアウト",
    "profile.noChanges": "保存する変更がありません。",
    "profile.updated": "プロフィールを更新しました。",
    "profile.language": "言語",
    "profile.theme": "テーマ",
    "profile.themeAuto": "自動",
    "profile.themeLight": "ライト",
    "profile.themeDark": "ダーク",
    "profile.color": "アプリの色",
    "profile.colorCustom": "カスタム",
    "profile.help": "ヘルプ",
    "profile.about": "アプリについて",
    "info.back": "戻る",
    "help.intro": "Panic Buttonを最大限に活用するために知っておきたいこと。",
    "help.section.account.title": "アカウントを作成する",
    "help.section.account.body": "氏名、電話番号、メールアドレス、パスワードを入力して登録してください。メールで確認リンクをお送りしますので、このデバイスで開いてアカウントを有効化し、その後ログインしてください。",
    "help.section.panic.title": "緊急通報を送信する",
    "help.section.panic.body": "ホーム画面でSOSボタンを約1.5秒間長押しします。押している間はボタンの周りにリングが表示されて満ちていき、途中で離すと送信はキャンセルされます。長押しが完了すると、アプリは現在地を取得し、確認済みのすべての緊急連絡先にメールで通知します。Telegramを連携している連絡先には、Telegramでも通知が届きます。",
    "help.section.contacts.title": "緊急連絡先を管理する",
    "help.section.contacts.body": "連絡先タブで＋ボタンをタップし、端末の連絡先から選ぶか、手動で情報を入力して相手を追加します。既存の連絡先をタップすると、情報の編集、Telegramの連携・解除、削除ができます。",
    "help.section.channels.title": "確認済みと未確認の連絡先",
    "help.section.channels.body": "連絡先を追加しただけでは自動的に通知されません。各連絡先にはメールのアイコンと、利用可能な場合はTelegramのアイコンが表示されます。アイコンが点灯していればそのチャネルは確認済みで通報を受け取り、暗いままであればまだ確認されていません。メールは相手が送られたリンクをクリックすると確認され、Telegramは相手がリンクを開き、ボットとのチャットで「開始」を押すと確認されます。",
    "help.section.profile.title": "あなたのプロフィール",
    "help.section.profile.body": "プロフィールタブから、名前、電話番号、メールアドレス、パスワードを更新できます。同じ画面からアプリの言語やテーマカラーも変更できますが、どちらもこのデバイスにのみ保存されます。",
    "about.description": "Panic Buttonは、個人の安全を守るためのアプリです。ボタンを長押しするだけで現在地を共有し、あなたが最も必要としている瞬間に、信頼できる緊急連絡先へメールとTelegramで通報します。",
    "about.developedBy": "開発：Skellent",
    "about.rights": "© Keycodelogics 全著作権所有。",
    "about.version": "バージョン：ベータ版"
  },
  ko: {
    "nav.home": "홈",
    "nav.contacts": "연락처",
    "nav.profile": "프로필",
    "route.login.title": "로그인",
    "route.register.title": "계정 만들기",
    "route.contacts.title": "비상 연락처",
    "route.profile.title": "내 프로필",
    "route.about.title": "정보",
    "route.help.title": "도움말",
    "errors.generic": "문제가 발생했습니다. 다시 시도해 주세요.",
    "errors.network": "서버에 연결할 수 없습니다. 연결 상태를 확인해 주세요.",
    "login.subtitle": "로그인하면 비상 연락처에 한 번의 터치로 연락할 수 있습니다.",
    "login.email": "이메일",
    "login.password": "비밀번호",
    "login.submit": "로그인",
    "login.switch": "계정이 없으신가요?",
    "login.switchLink": "계정 만들기",
    "register.subtitle": "몇 가지 정보만 입력하면 비상 연락처를 추가할 수 있습니다.",
    "register.name": "이름",
    "register.phone": "전화번호",
    "register.email": "이메일",
    "register.password": "비밀번호",
    "register.confirmPassword": "비밀번호 확인",
    "register.submit": "계정 만들기",
    "register.switch": "이미 계정이 있으신가요?",
    "register.switchLink": "로그인",
    "register.passwordMismatch": "비밀번호가 일치하지 않습니다.",
    "confirmMail.title": "이메일을 확인해 주세요",
    "confirmMail.subtitle": '<span class="confirm-mail-email">{email}</span>(으)로 확인 링크를 보내드렸습니다.<br />이 기기에서 링크를 열어 계정을 활성화한 뒤 다시 로그인해 주세요.',
    "confirmMail.back": "로그인으로 돌아가기",
    "home.greeting": "안녕하세요, {name}님",
    "home.panicAria": "길게 눌러 긴급 알림 보내기",
    "home.idle": "길게 눌러 연락처에 알리기",
    "home.holding": "확정하려면 계속 누르고 있으세요...",
    "home.locating": "위치를 확인하는 중...",
    "home.sending": "알림을 보내는 중...",
    "home.sent": "알림 전송 완료 — 연락처에 알리는 중입니다",
    "home.sentToast": "긴급 알림을 성공적으로 보냈습니다.",
    "home.errorFallback": "알림을 보내지 못했습니다.",
    "home.statusReady": "알림을 받을 준비된 연락처 {count}명",
    "home.statusReadyPlural": "알림을 받을 준비된 연락처 {count}명",
    "home.statusNone": "아직 확인된 연락처가 없습니다",
    "contacts.empty": "아직 등록된 비상 연락처가 없습니다. + 버튼을 눌러 긴급 알림 시 알려야 할 사람을 추가하세요.",
    "contacts.loadError": "연락처를 불러오지 못했습니다. 이 탭을 다시 열어 재시도해 주세요.",
    "contacts.loadErrorToast": "연락처를 불러오지 못했습니다.",
    "contacts.limitReached": "비상 연락처 한도({max}명)에 도달했습니다.",
    "contacts.confirmed": "확인됨",
    "contacts.pending": "대기 중",
    "contacts.addTitle": "비상 연락처 추가",
    "contacts.pickDevice": "기기 연락처에서 선택",
    "contacts.addManually": "직접 추가",
    "contacts.editTitle": "연락처 수정",
    "contacts.name": "이름",
    "contacts.phone": "전화번호",
    "contacts.email": "이메일",
    "contacts.emailRequired": "이 연락처의 이메일 주소를 입력해 주세요.",
    "contacts.emailHint": "이 연락처에 확인 링크를 이메일로 보내드립니다 — 확인된 연락처만 긴급 알림을 받습니다.",
    "contacts.save": "변경사항 저장",
    "contacts.add": "연락처 추가",
    "contacts.delete": "연락처 삭제",
    "contacts.updated": "연락처가 업데이트되었습니다.",
    "contacts.addedWithEmail": "연락처가 추가되었습니다 — 확인 이메일을 보냈습니다.",
    "contacts.removed": "연락처가 삭제되었습니다.",
    "contacts.removeError": "연락처를 삭제하지 못했습니다.",
    "contacts.removeConfirm": "{name}님을 비상 연락처에서 삭제할까요?",
    "contacts.pickError": "연락처에 접근하지 못했습니다.",
    "contacts.telegramLinked": "Telegram 연결됨",
    "contacts.telegramNotLinked": "Telegram 연결 안 됨",
    "contacts.telegramConnect": "Telegram 연결",
    "contacts.telegramDisconnect": "Telegram 연결 해제",
    "contacts.telegramEmailSent": "Telegram 링크를 상대방 이메일로 보냈습니다.",
    "contacts.telegramLinkReady": "Telegram 링크가 복사되었습니다 — 연락처에 공유해 주세요.",
    "contacts.telegramDisconnected": "Telegram 연결이 해제되었습니다.",
    "contacts.telegramEnableError": "Telegram 연결을 시작하지 못했습니다.",
    "contacts.telegramDisableError": "Telegram 연결을 해제하지 못했습니다.",
    "profile.name": "이름",
    "profile.phone": "전화번호",
    "profile.email": "이메일",
    "profile.newPassword": "새 비밀번호 (선택 사항)",
    "profile.newPasswordPlaceholder": "변경하지 않으려면 비워 두세요",
    "profile.save": "변경사항 저장",
    "profile.logout": "로그아웃",
    "profile.noChanges": "저장할 변경사항이 없습니다.",
    "profile.updated": "프로필이 업데이트되었습니다.",
    "profile.language": "언어",
    "profile.theme": "테마",
    "profile.themeAuto": "자동",
    "profile.themeLight": "라이트",
    "profile.themeDark": "다크",
    "profile.color": "앱 색상",
    "profile.colorCustom": "사용자 지정",
    "profile.help": "도움말",
    "profile.about": "정보",
    "info.back": "뒤로",
    "help.intro": "Panic Button를 100% 활용하기 위해 알아야 할 모든 것.",
    "help.section.account.title": "계정 만들기",
    "help.section.account.body": "이름, 전화번호, 이메일과 비밀번호로 가입하세요. 이메일로 확인 링크를 보내드리니, 이 기기에서 열어 계정을 활성화한 뒤 다시 로그인해 주세요.",
    "help.section.panic.title": "긴급 알림 보내기",
    "help.section.panic.body": "홈 화면에서 SOS 버튼을 약 1.5초간 길게 누르세요 — 누르고 있는 동안 버튼 주위로 원형 링이 채워지며, 도중에 손을 떼면 전송이 취소됩니다. 완료되면 앱이 현재 위치를 확인하고, 확인된 모든 비상 연락처에 이메일로 알리며 Telegram을 연결한 연락처에는 Telegram으로도 알립니다.",
    "help.section.contacts.title": "비상 연락처 관리",
    "help.section.contacts.body": "연락처 탭에서 + 버튼을 눌러 사람을 추가하세요 — 휴대폰 주소록에서 선택하거나 직접 정보를 입력할 수 있습니다. 기존 연락처를 눌러 정보를 수정하거나, Telegram을 연결·해제하거나, 삭제할 수 있습니다.",
    "help.section.channels.title": "확인됨 vs. 대기 중 연락처",
    "help.section.channels.body": "연락처를 추가한다고 자동으로 알림이 가는 것은 아닙니다 — 각 연락처에는 이메일 아이콘과, 가능한 경우 Telegram 아이콘이 표시됩니다. 아이콘이 켜져 있으면 해당 채널이 확인되어 알림을 받는다는 뜻이고, 꺼져 있으면 아직 아니라는 뜻입니다. 이메일은 연락처가 전송된 링크를 클릭하면 확인되고, Telegram은 링크를 열어 봇과의 채팅에서 시작을 누르는 순간 확인됩니다.",
    "help.section.profile.title": "내 프로필",
    "help.section.profile.body": "프로필 탭에서 이름, 전화번호, 이메일, 비밀번호를 업데이트할 수 있습니다. 같은 화면에서 앱의 언어와 색상도 변경할 수 있으며, 두 설정 모두 이 기기에만 저장됩니다.",
    "about.description": "Panic Button는 개인 안전을 위한 앱입니다. 버튼을 길게 누르는 것만으로 위치를 공유하고, 가장 필요한 순간에 신뢰하는 비상 연락처에 이메일과 Telegram으로 알릴 수 있습니다.",
    "about.developedBy": "개발: Skellent",
    "about.rights": "© Keycodelogics. 모든 권리 보유.",
    "about.version": "버전: 베타"
  },
  hi: {
    "nav.home": "होम",
    "nav.contacts": "संपर्क",
    "nav.profile": "प्रोफ़ाइल",
    "route.login.title": "लॉग इन करें",
    "route.register.title": "खाता बनाएँ",
    "route.contacts.title": "आपातकालीन संपर्क",
    "route.profile.title": "मेरी प्रोफ़ाइल",
    "route.about.title": "ऐप के बारे में",
    "route.help.title": "सहायता",
    "errors.generic": "कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।",
    "errors.network": "सर्वर से कनेक्ट नहीं हो सका। अपना कनेक्शन जाँचें।",
    "login.subtitle": "लॉग इन करें ताकि आपके आपातकालीन संपर्क हमेशा एक टैप दूर रहें।",
    "login.email": "ईमेल",
    "login.password": "पासवर्ड",
    "login.submit": "लॉग इन करें",
    "login.switch": "खाता नहीं है?",
    "login.switchLink": "खाता बनाएँ",
    "register.subtitle": "बस कुछ जानकारी, और आप अपने आपातकालीन संपर्क जोड़ने के लिए तैयार होंगे।",
    "register.name": "पूरा नाम",
    "register.phone": "फ़ोन नंबर",
    "register.email": "ईमेल",
    "register.password": "पासवर्ड",
    "register.confirmPassword": "पासवर्ड की पुष्टि करें",
    "register.submit": "खाता बनाएँ",
    "register.switch": "पहले से खाता है?",
    "register.switchLink": "लॉग इन करें",
    "register.passwordMismatch": "पासवर्ड मेल नहीं खाते।",
    "confirmMail.title": "अपना ईमेल जाँचें",
    "confirmMail.subtitle": 'हमने<br /><span class="confirm-mail-email">{email}</span> पर एक पुष्टिकरण लिंक भेजा है। अपना खाता सक्रिय करने के लिए इसे इसी डिवाइस पर खोलें, फिर वापस आकर लॉग इन करें।',
    "confirmMail.back": "लॉग इन पर वापस जाएँ",
    "home.greeting": "नमस्ते, {name}",
    "home.panicAria": "पैनिक अलर्ट भेजने के लिए दबाए रखें",
    "home.idle": "अपने संपर्कों को सूचित करने के लिए दबाए रखें",
    "home.holding": "पुष्टि करने के लिए दबाए रखना जारी रखें...",
    "home.locating": "आपकी लोकेशन प्राप्त की जा रही है...",
    "home.sending": "अलर्ट भेजा जा रहा है...",
    "home.sent": "अलर्ट भेज दिया गया — आपके संपर्कों को सूचित किया जा रहा है",
    "home.sentToast": "पैनिक अलर्ट सफलतापूर्वक भेजा गया।",
    "home.errorFallback": "अलर्ट नहीं भेजा जा सका।",
    "home.statusReady": "{count} संपर्क अलर्ट पाने के लिए तैयार",
    "home.statusReadyPlural": "{count} संपर्क अलर्ट पाने के लिए तैयार",
    "home.statusNone": "अभी तक कोई पुष्टि किया गया संपर्क नहीं है",
    "contacts.empty": "अभी तक आपका कोई आपातकालीन संपर्क नहीं है। पैनिक अलर्ट भेजने पर जिसे सूचित किया जाना चाहिए, उसे जोड़ने के लिए + बटन दबाएँ।",
    "contacts.loadError": "आपके संपर्क लोड नहीं हो सके। फिर से कोशिश करने के लिए इस टैब को दोबारा खोलें।",
    "contacts.loadErrorToast": "संपर्क लोड नहीं हो सके।",
    "contacts.limitReached": "आप आपातकालीन संपर्कों की सीमा ({max}) तक पहुँच चुके हैं।",
    "contacts.confirmed": "पुष्टि हो गई",
    "contacts.pending": "लंबित",
    "contacts.addTitle": "आपातकालीन संपर्क जोड़ें",
    "contacts.pickDevice": "डिवाइस के संपर्कों से चुनें",
    "contacts.addManually": "स्वयं जोड़ें",
    "contacts.editTitle": "संपर्क संपादित करें",
    "contacts.name": "नाम",
    "contacts.phone": "फ़ोन नंबर",
    "contacts.email": "ईमेल",
    "contacts.emailRequired": "कृपया इस संपर्क के लिए एक ईमेल दर्ज करें।",
    "contacts.emailHint": "हम इस संपर्क को ईमेल से एक पुष्टिकरण लिंक भेजेंगे — पैनिक अलर्ट के दौरान केवल पुष्टि किए गए संपर्कों को ही सूचित किया जाता है।",
    "contacts.save": "बदलाव सहेजें",
    "contacts.add": "संपर्क जोड़ें",
    "contacts.delete": "संपर्क हटाएँ",
    "contacts.updated": "संपर्क अपडेट हो गया।",
    "contacts.addedWithEmail": "संपर्क जोड़ा गया — पुष्टिकरण ईमेल भेज दिया गया है।",
    "contacts.removed": "संपर्क हटा दिया गया।",
    "contacts.removeError": "संपर्क हटाया नहीं जा सका।",
    "contacts.removeConfirm": "क्या {name} को आपके आपातकालीन संपर्कों से हटाना है?",
    "contacts.pickError": "आपके संपर्कों तक पहुँचा नहीं जा सका।",
    "contacts.telegramLinked": "Telegram जुड़ा हुआ है",
    "contacts.telegramNotLinked": "Telegram जुड़ा नहीं है",
    "contacts.telegramConnect": "Telegram जोड़ें",
    "contacts.telegramDisconnect": "Telegram हटाएँ",
    "contacts.telegramEmailSent": "Telegram लिंक उनके ईमेल पर भेज दिया गया है।",
    "contacts.telegramLinkReady": "Telegram लिंक तैयार है — कॉपी कर लिया गया है, इसे अपने संपर्क के साथ साझा करें।",
    "contacts.telegramDisconnected": "Telegram हटा दिया गया।",
    "contacts.telegramEnableError": "Telegram लिंकिंग शुरू नहीं हो सकी।",
    "contacts.telegramDisableError": "Telegram हटाया नहीं जा सका।",
    "profile.name": "नाम",
    "profile.phone": "फ़ोन नंबर",
    "profile.email": "ईमेल",
    "profile.newPassword": "नया पासवर्ड (वैकल्पिक)",
    "profile.newPasswordPlaceholder": "मौजूदा पासवर्ड रखने के लिए खाली छोड़ दें",
    "profile.save": "बदलाव सहेजें",
    "profile.logout": "लॉग आउट करें",
    "profile.noChanges": "सहेजने के लिए कोई बदलाव नहीं है।",
    "profile.updated": "प्रोफ़ाइल अपडेट हो गई।",
    "profile.language": "भाषा",
    "profile.theme": "थीम",
    "profile.themeAuto": "स्वचालित",
    "profile.themeLight": "हल्का",
    "profile.themeDark": "गहरा",
    "profile.color": "ऐप का रंग",
    "profile.colorCustom": "कस्टम",
    "profile.help": "सहायता",
    "profile.about": "ऐप के बारे में",
    "info.back": "वापस",
    "help.intro": "Panic Button का पूरा फ़ायदा उठाने के लिए आपको जो कुछ जानना चाहिए।",
    "help.section.account.title": "अपना खाता बनाना",
    "help.section.account.body": "अपने नाम, फ़ोन नंबर, ईमेल और एक पासवर्ड के साथ रजिस्टर करें। हम आपके ईमेल पर एक पुष्टिकरण लिंक भेजेंगे — अपना खाता सक्रिय करने के लिए इसे इसी डिवाइस पर खोलें, फिर वापस आकर लॉग इन करें।",
    "help.section.panic.title": "पैनिक अलर्ट भेजना",
    "help.section.panic.body": "होम स्क्रीन पर, SOS बटन को लगभग डेढ़ सेकंड तक दबाए रखें — जब तक आप दबाए रखते हैं, बटन के चारों ओर एक रिंग भरती जाती है, और जल्दी छोड़ देने पर भेजना रद्द हो जाता है। पूरा होने पर, ऐप आपकी वर्तमान लोकेशन प्राप्त करता है और हर पुष्टि किए गए आपातकालीन संपर्क को ईमेल से सूचित करता है, और जिन्होंने Telegram जोड़ा है उन्हें Telegram से भी।",
    "help.section.contacts.title": "आपातकालीन संपर्कों का प्रबंधन",
    "help.section.contacts.body": "संपर्क टैब में, किसी को जोड़ने के लिए + बटन दबाएँ — या तो अपने फ़ोन की संपर्क सूची से चुनकर, या विवरण खुद दर्ज करके। किसी मौजूदा संपर्क को दबाकर उसका विवरण बदलें, Telegram जोड़ें या हटाएँ, या उसे हटा दें।",
    "help.section.channels.title": "पुष्टि किए गए बनाम लंबित संपर्क",
    "help.section.channels.body": "किसी संपर्क को जोड़ने भर से उसे अपने आप सूचना नहीं मिलती — हर संपर्क पर एक ईमेल आइकन और, यदि उपलब्ध हो तो, एक Telegram आइकन दिखता है; जलता हुआ आइकन बताता है कि वह चैनल पुष्टि किया जा चुका है और अलर्ट पाएगा, धुंधला आइकन बताता है कि अभी नहीं। ईमेल तब पुष्टि होता है जब संपर्क भेजे गए लिंक पर क्लिक करता है; Telegram तब पुष्टि होता है जब वह लिंक खोलकर हमारे बॉट के साथ चैट में Start दबाता है।",
    "help.section.profile.title": "आपकी प्रोफ़ाइल",
    "help.section.profile.body": "प्रोफ़ाइल टैब से अपना नाम, फ़ोन नंबर, ईमेल या पासवर्ड अपडेट करें। वहीं से आप ऐप की भाषा और रंग भी बदल सकते हैं — दोनों केवल इसी डिवाइस पर सहेजे जाते हैं।",
    "about.description": "Panic Button एक व्यक्तिगत सुरक्षा ऐप है: एक बटन दबाए रखें और अपनी लोकेशन साझा करें, और जिस पल आपको उनकी सबसे ज़्यादा ज़रूरत हो, उस पल अपने भरोसेमंद आपातकालीन संपर्कों को ईमेल और Telegram के ज़रिए सतर्क करें।",
    "about.developedBy": "Skellent द्वारा विकसित",
    "about.rights": "© Keycodelogics. सर्वाधिकार सुरक्षित।",
    "about.version": "संस्करण: बीटा"
  }
};
var currentLang = "en";
function detectLanguage() {
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en") || "en";
  const lower = nav.toLowerCase();
  if (lower.startsWith("pt"))
    return lower === "pt-pt" || lower.startsWith("pt-pt") ? "pt-PT" : "pt-BR";
  const prefixMatch = { es: "es", fr: "fr", de: "de", it: "it", ru: "ru", zh: "zh", ja: "ja", ko: "ko", hi: "hi" };
  const prefix = lower.slice(0, 2);
  return prefixMatch[prefix] ?? "en";
}
async function loadLanguage() {
  const { value } = await Preferences.get({ key: LANG_KEY });
  currentLang = SUPPORTED.includes(value) ? value : detectLanguage();
  return currentLang;
}
async function setLanguage(lang) {
  if (!SUPPORTED.includes(lang))
    return;
  currentLang = lang;
  await Preferences.set({ key: LANG_KEY, value: lang });
}
function getLanguage() {
  return currentLang;
}
function t(key, vars) {
  const template = STRINGS[currentLang]?.[key] ?? STRINGS.en[key] ?? key;
  if (!vars)
    return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
}

// src/lib/api.js
var BASE_URL = "https://devs.panicbutton.me";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
function extractMessage(body) {
  if (!body)
    return t("errors.generic");
  if (typeof body.detail === "string")
    return body.detail;
  if (Array.isArray(body.detail) && body.detail[0]?.msg)
    return body.detail[0].msg;
  return t("errors.generic");
}
async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token)
      headers["Authorization"] = `Bearer ${token}`;
  }
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(t("errors.network"), 0);
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(extractMessage(data), response.status);
  }
  return data;
}
var Api = {
  register: (data) => request("/auth/register", { method: "POST", body: data }),
  login: (data) => request("/auth/login", { method: "POST", body: data }),
  getMe: () => request("/users/me", { auth: true }),
  updateMe: (data) => request("/users/me", { method: "PUT", body: data, auth: true }),
  listContacts: () => request("/contacts", { auth: true }),
  createContact: (data) => request("/contacts", { method: "POST", body: data, auth: true }),
  updateContact: (id, data) => request(`/contacts/${id}`, { method: "PUT", body: data, auth: true }),
  deleteContact: (id) => request(`/contacts/${id}`, { method: "DELETE", auth: true }),
  resendContactConfirmation: (id) => request(`/contacts/${id}/confirm/resend`, { method: "POST", auth: true }),
  enableContactTelegram: (id) => request(`/contacts/${id}/telegram/enable`, { method: "POST", auth: true }),
  disableContactTelegram: (id) => request(`/contacts/${id}/telegram`, { method: "DELETE", auth: true }),
  enableContactWhatsapp: (id) => request(`/contacts/${id}/whatsapp/enable`, { method: "POST", auth: true }),
  disableContactWhatsapp: (id) => request(`/contacts/${id}/whatsapp`, { method: "DELETE", auth: true }),
  createAlert: (data) => request("/alerts", { method: "POST", body: data, auth: true }),
  getFeatures: () => request("/features")
};

// src/lib/theme.js
var COLOR_KEY = "panicbutton.accentColor";
var THEME_KEY = "panicbutton.theme";
var DEFAULT_ACCENT = "#ea2052";
var DEFAULT_THEME = "auto";
var THEMES = ["auto", "light", "dark"];
var SHADE_LIGHTNESS = {
  dark: { 900: 0.3, 800: 0.38, 700: 0.45, 600: 0.5, 500: 0.55, 400: 0.65, 300: 0.78 },
  light: { 900: 0.3, 800: 0.38, 700: 0.45, 600: 0.5, 500: 0.55, 400: 0.46, 300: 0.4 }
};
var ALPHA = {
  dark: { glow: 0.55, tint: 0.14 },
  light: { glow: 0.35, tint: 0.14 }
};
var currentAccent = DEFAULT_ACCENT;
var currentTheme = DEFAULT_THEME;
var _media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  return { r: value >> 16 & 255, g: value >> 8 & 255, b: value & 255 };
}
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min)
    return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return { h: h / 6, s, l };
}
function hue2rgb(p, q, t2) {
  if (t2 < 0)
    t2 += 1;
  if (t2 > 1)
    t2 -= 1;
  if (t2 < 1 / 6)
    return p + (q - p) * 6 * t2;
  if (t2 < 1 / 2)
    return q;
  if (t2 < 2 / 3)
    return p + (q - p) * (2 / 3 - t2) * 6;
  return p;
}
function hslToHex(h, s, l) {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return toHex(gray, gray, gray);
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return toHex(Math.round(hue2rgb(p, q, h + 1 / 3) * 255), Math.round(hue2rgb(p, q, h) * 255), Math.round(hue2rgb(p, q, h - 1 / 3) * 255));
}
function toHex(r, g, b) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function scheme() {
  if (currentTheme === "light" || currentTheme === "dark")
    return currentTheme;
  return _media && !_media.matches ? "light" : "dark";
}
function applyAccentColor(hex) {
  currentAccent = hex;
  const { r, g, b } = hexToRgb(hex);
  const { h, s } = rgbToHsl(r, g, b);
  const mode = scheme();
  const root = document.documentElement.style;
  for (const [shade, l] of Object.entries(SHADE_LIGHTNESS[mode])) {
    root.setProperty(`--primary-${shade}`, hslToHex(h, s, l));
  }
  root.setProperty("--primary-rgb", `${r}, ${g}, ${b}`);
  root.setProperty("--primary-50", `rgba(${r}, ${g}, ${b}, ${ALPHA[mode].tint})`);
  root.setProperty("--glow", `rgba(${r}, ${g}, ${b}, ${ALPHA[mode].glow})`);
}
async function loadAccentColor() {
  const { value } = await Preferences.get({ key: COLOR_KEY });
  applyAccentColor(value || DEFAULT_ACCENT);
  return currentAccent;
}
async function setAccentColor(hex) {
  await Preferences.set({ key: COLOR_KEY, value: hex });
  applyAccentColor(hex);
}
function getAccentColor() {
  return currentAccent;
}
function applyTheme(theme) {
  currentTheme = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  document.documentElement.dataset.theme = currentTheme;
  applyAccentColor(currentAccent);
}
async function loadTheme() {
  const { value } = await Preferences.get({ key: THEME_KEY });
  applyTheme(value || DEFAULT_THEME);
  return currentTheme;
}
async function setTheme(theme) {
  await Preferences.set({ key: THEME_KEY, value: theme });
  applyTheme(theme);
}
function getTheme() {
  return currentTheme;
}
if (_media) {
  _media.addEventListener("change", () => applyAccentColor(currentAccent));
}

// node_modules/@capacitor/app/dist/esm/index.js
init_dist();
var App = registerPlugin("App", {
  web: () => Promise.resolve().then(() => (init_web3(), exports_web3)).then((m) => new m.AppWeb)
});

// src/lib/appUpdate.js
var VERSION_KEY = "panicbutton.appVersion";
var BASE_URL2 = "https://devs.panicbutton.me";
async function fetchManifestVersion() {
  const response = await fetch(`${BASE_URL2}/app/manifest`, { cache: "no-store" });
  if (!response.ok)
    return null;
  const { version } = await response.json();
  return version;
}
async function checkForUpdate() {
  let latest;
  try {
    latest = await fetchManifestVersion();
  } catch {
    return;
  }
  if (!latest)
    return;
  const { value: known } = await Preferences.get({ key: VERSION_KEY });
  if (known === null) {
    await Preferences.set({ key: VERSION_KEY, value: latest });
    return;
  }
  if (known !== latest) {
    await Preferences.set({ key: VERSION_KEY, value: latest });
    window.location.reload();
  }
}
function initAppUpdates() {
  checkForUpdate();
  App.addListener("resume", checkForUpdate);
}

// src/lib/toast.js
var container = null;
function ensureContainer() {
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}
function showToast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  ensureContainer().appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast-visible"));
  setTimeout(() => {
    el.classList.remove("toast-visible");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
  }, 3400);
}

// src/lib/dom.js
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}
function setLoading(button, loading) {
  button.disabled = loading;
  button.querySelector(".btn-label").hidden = loading;
  button.querySelector(".btn-spinner").hidden = !loading;
}
function shake(el) {
  el.classList.remove("shake");
  el.offsetWidth;
  el.classList.add("shake");
}

// src/views/login.js
async function renderLogin(container2, { navigate, refreshUser }) {
  container2.innerHTML = `
    <div class="auth-screen">
      <img class="brand-mark" src="assets/brand-mark.png" alt="" />
      <h1 class="auth-title">Panic Button</h1>
      <p class="auth-subtitle">${t("login.subtitle")}</p>

      <form id="login-form" class="form" novalidate>
        <label class="field">
          <span>${t("login.email")}</span>
          <input type="email" name="email" autocomplete="email" required />
        </label>
        <label class="field">
          <span>${t("login.password")}</span>
          <input type="password" name="password" autocomplete="current-password" required />
        </label>
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-label">${t("login.submit")}</span>
          <span class="btn-spinner" hidden></span>
        </button>
      </form>

      <p class="auth-switch">${t("login.switch")} <a href="#/register">${t("login.switchLink")}</a></p>
    </div>
  `;
  const form = container2.querySelector("#login-form");
  const button = form.querySelector('button[type="submit"]');
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      setLoading(button, true);
      const { access_token } = await Api.login(data);
      await setToken(access_token);
      await refreshUser();
      navigate("home");
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : t("errors.generic"), "error");
    } finally {
      setLoading(button, false);
    }
  });
}

// src/lib/icons.js
function icon(path, viewBox = "0 0 24 24") {
  return `<svg class="icon" viewBox="${viewBox}" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
}
var Icon = {
  home: () => icon("M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"),
  contacts: () => icon("M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"),
  settings: () => icon("M19.14,12.94c0.04,-0.3 0.06,-0.61 0.06,-0.94c0,-0.32 -0.02,-0.64 -0.07,-0.94l2.03,-1.58c0.18,-0.14 0.23,-0.41 0.12,-0.61l-1.92,-3.32c-0.12,-0.22 -0.37,-0.29 -0.59,-0.22l-2.39,0.96c-0.5,-0.38 -1.03,-0.7 -1.62,-0.94L14.4,2.81c-0.04,-0.24 -0.24,-0.41 -0.48,-0.41h-3.84c-0.24,0 -0.43,0.17 -0.47,0.41L9.25,5.35C8.66,5.59 8.12,5.92 7.63,6.29L5.24,5.33c-0.22,-0.08 -0.47,0 -0.59,0.22L2.74,8.87C2.62,9.08 2.66,9.34 2.86,9.48l2.03,1.58C4.84,11.36 4.8,11.69 4.8,12s0.02,0.64 0.07,0.94l-2.03,1.58c-0.18,0.14 -0.23,0.41 -0.12,0.61l1.92,3.32c0.12,0.22 0.37,0.29 0.59,0.22l2.39,-0.96c0.5,0.38 1.03,0.7 1.62,0.94l0.36,2.54c0.05,0.24 0.24,0.41 0.48,0.41h3.84c0.24,0 0.44,-0.17 0.47,-0.41l0.36,-2.54c0.59,-0.24 1.13,-0.56 1.62,-0.94l2.39,0.96c0.22,0.08 0.47,0 0.59,-0.22l1.92,-3.32c0.12,-0.22 0.07,-0.47 -0.12,-0.61L19.14,12.94zM12,15.6c-1.98,0 -3.6,-1.62 -3.6,-3.6s1.62,-3.6 3.6,-3.6s3.6,1.62 3.6,3.6S13.98,15.6 12,15.6z"),
  add: () => icon("M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"),
  delete: () => icon("M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"),
  checkCircle: () => icon("M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"),
  mail: () => icon("M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"),
  arrowBack: () => icon("M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"),
  close: () => icon("M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"),
  schedule: () => icon("M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"),
  phone: () => icon("M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"),
  personAdd: () => icon("M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"),
  edit: () => icon("M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"),
  logout: () => icon("M17 7l-1.41 1.41L17.17 10H8v2h9.17l-1.58 1.59L17 15l4-4zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"),
  language: () => icon("M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-.61.08-1.21.21-1.78L8.99 15v1c0 1.1.9 2 2 2v1.93C7.06 19.44 4 16.08 4 12zm13.89 5.4c-.26-.81-1-1.4-1.89-1.4h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.11 5.4z"),
  theme: () => icon("M12 2a10 10 0 100 20 10 10 0 000-20zm0 2v16a8 8 0 010-16z"),
  palette: () => icon("M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.6-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"),
  telegram: () => icon("M248 8C111 8 0 119 0 256S111 504 248 504 496 393 496 256 385 8 248 8zM362 176.7c-3.7 39.2-19.9 134.4-28.1 178.3-3.5 18.6-10.4 24.8-17 25.4-14.4 1.3-25.3-9.5-39.3-18.7-21.8-14.3-34.2-23.2-55.3-37.2-24.5-16.1-8.6-25 5.3-39.5 3.7-3.8 67.1-61.5 68.3-66.7 .2-.7 .3-3.1-1.2-4.4s-3.6-.8-5.1-.5q-3.3 .7-104.6 69.1-14.8 10.2-26.9 9.9c-8.9-.2-25.9-5-38.6-9.1-15.5-5-27.9-7.7-26.8-16.3q.8-6.7 18.5-13.7 108.4-47.2 144.6-62.3c68.9-28.6 83.2-33.6 92.5-33.8 2.1 0 6.6 .5 9.6 2.9a10.5 10.5 0 0 1 3.5 6.7A43.8 43.8 0 0 1 362 176.7z", "0 0 496 512"),
  whatsapp: () => icon("M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z", "0 0 448 512"),
  info: () => icon("M11 7h2v2h-2V7zm0 4h2v6h-2v-6zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"),
  help: () => icon("M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z")
};

// src/lib/phone.js
var DEFAULT_COUNTRY_CODE = "+1";
var COUNTRY_CODES = [
  { code: "+1", country: "US/CA" },
  { code: "+34", country: "ES" },
  { code: "+52", country: "MX" },
  { code: "+54", country: "AR" },
  { code: "+57", country: "CO" },
  { code: "+56", country: "CL" },
  { code: "+51", country: "PE" },
  { code: "+58", country: "VE" },
  { code: "+593", country: "EC" },
  { code: "+502", country: "GT" },
  { code: "+503", country: "SV" },
  { code: "+504", country: "HN" },
  { code: "+505", country: "NI" },
  { code: "+506", country: "CR" },
  { code: "+507", country: "PA" },
  { code: "+591", country: "BO" },
  { code: "+595", country: "PY" },
  { code: "+598", country: "UY" },
  { code: "+55", country: "BR" },
  { code: "+44", country: "UK" },
  { code: "+49", country: "DE" },
  { code: "+33", country: "FR" },
  { code: "+39", country: "IT" }
];
var _codesByLength = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
function sanitizePhoneDigits(value) {
  return value.replace(/\D/g, "");
}
function splitPhone(fullPhone) {
  const value = (fullPhone ?? "").trim();
  const match = _codesByLength.find((entry) => value.startsWith(entry.code));
  if (match)
    return { countryCode: match.code, number: sanitizePhoneDigits(value.slice(match.code.length)) };
  return { countryCode: DEFAULT_COUNTRY_CODE, number: sanitizePhoneDigits(value) };
}
function combinePhone(countryCode, number) {
  return `${countryCode}${sanitizePhoneDigits(number)}`;
}
function buildCountryCodeOptions(selectedCode) {
  return COUNTRY_CODES.map(({ code, country }) => `<option value="${code}" ${code === selectedCode ? "selected" : ""}>${code} ${country}</option>`).join("");
}
function attachPhoneSanitizer(input) {
  input.addEventListener("input", () => {
    const digitsOnly = sanitizePhoneDigits(input.value);
    if (digitsOnly !== input.value)
      input.value = digitsOnly;
  });
}

// src/views/register.js
var EMAIL_DOMAINS = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"];
function insertEmailDomain(input, domain) {
  const at = input.value.indexOf("@");
  const local = at >= 0 ? input.value.slice(0, at) : input.value;
  input.value = `${local}@${domain}`;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}
async function renderRegister(container2, { navigate }) {
  container2.innerHTML = `
    <div class="auth-screen">
      <img class="brand-mark" src="assets/brand-mark.png" alt="" />
      <h1 class="auth-title">${t("route.register.title")}</h1>
      <p class="auth-subtitle">${t("register.subtitle")}</p>

      <form id="register-form" class="form" novalidate>
        <label class="field">
          <span>${t("register.name")}</span>
          <input type="text" name="name" autocomplete="name" required />
        </label>
        <label class="field">
          <span>${t("register.phone")}</span>
          <div class="phone-field">
            <select name="phone_country" class="phone-country">${buildCountryCodeOptions(DEFAULT_COUNTRY_CODE)}</select>
            <input type="tel" name="phone_number" autocomplete="tel" inputmode="numeric" required />
          </div>
        </label>
        <label class="field">
          <span>${t("register.email")}</span>
          <input type="email" name="email" autocomplete="email" required />
          <div class="email-domain-chips">
            ${EMAIL_DOMAINS.map((domain) => `<button type="button" class="email-domain-chip" data-domain="${domain}">@${domain}</button>`).join("")}
          </div>
        </label>
        <label class="field">
          <span>${t("register.password")}</span>
          <input type="password" name="password" autocomplete="new-password" minlength="8" required />
        </label>
        <label class="field">
          <span>${t("register.confirmPassword")}</span>
          <input type="password" name="confirm_password" autocomplete="new-password" required />
        </label>
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-label">${t("register.submit")}</span>
          <span class="btn-spinner" hidden></span>
        </button>
      </form>

      <p class="auth-switch">${t("register.switch")} <a href="#/login">${t("register.switchLink")}</a></p>
    </div>
  `;
  const form = container2.querySelector("#register-form");
  const button = form.querySelector('button[type="submit"]');
  attachPhoneSanitizer(form.querySelector('input[name="phone_number"]'));
  const emailInput = form.querySelector('input[name="email"]');
  form.querySelectorAll(".email-domain-chip").forEach((chip) => {
    chip.addEventListener("click", () => insertEmailDomain(emailInput, chip.dataset.domain));
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { confirm_password, phone_country, phone_number, ...data } = Object.fromEntries(new FormData(form));
    data.phone = combinePhone(phone_country, phone_number);
    if (data.password !== confirm_password) {
      shake(form);
      showToast(t("register.passwordMismatch"), "error");
      return;
    }
    try {
      setLoading(button, true);
      await Api.register(data);
      renderConfirmEmail(container2, data.email, navigate);
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : t("errors.generic"), "error");
      setLoading(button, false);
    }
  });
}
function renderConfirmEmail(container2, email, navigate) {
  container2.innerHTML = `
    <div class="confirm-mail-screen">
      <div class="confirm-mail-icon">${Icon.mail()}</div>
      <h1 class="auth-title">${t("confirmMail.title")}</h1>
      <p class="auth-subtitle">${t("confirmMail.subtitle", { email: escapeHtml(email) })}</p>
      <button id="back-to-login" class="btn btn-outline" type="button">${t("confirmMail.back")}</button>
    </div>
  `;
  container2.querySelector("#back-to-login").addEventListener("click", () => navigate("login"));
}

// node_modules/@capacitor/geolocation/dist/esm/index.js
init_dist();

// node_modules/@capacitor/synapse/dist/synapse.mjs
function s(t2) {
  t2.CapacitorUtils.Synapse = new Proxy({}, {
    get(e, n) {
      return new Proxy({}, {
        get(w, o) {
          return (c, p, r) => {
            const i = t2.Capacitor.Plugins[n];
            if (i === undefined) {
              r(new Error(`Capacitor plugin ${n} not found`));
              return;
            }
            if (typeof i[o] != "function") {
              r(new Error(`Method ${o} not found in Capacitor plugin ${n}`));
              return;
            }
            (async () => {
              try {
                const a = await i[o](c);
                p(a);
              } catch (a) {
                r(a);
              }
            })();
          };
        }
      });
    }
  });
}
function u(t2) {
  t2.CapacitorUtils.Synapse = new Proxy({}, {
    get(e, n) {
      return t2.cordova.plugins[n];
    }
  });
}
function f(t2 = false) {
  typeof window > "u" || (window.CapacitorUtils = window.CapacitorUtils || {}, window.Capacitor !== undefined && !t2 ? s(window) : window.cordova !== undefined && u(window));
}

// node_modules/@capacitor/geolocation/dist/esm/index.js
var Geolocation2 = registerPlugin("Geolocation", {
  web: () => Promise.resolve().then(() => (init_web4(), exports_web4)).then((m) => new m.GeolocationWeb)
});
f();

// src/lib/geolocation.js
async function getCurrentCoordinates() {
  try {
    const position = await Geolocation2.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000
    });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    throw new Error("Couldn't get your location. Make sure location access is enabled for Panic Button.");
  }
}

// src/views/home.js
var HOLD_DURATION_MS = 1400;
var RING_RADIUS = 54;
var RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
var RESET_DELAY_MS = 2600;
async function renderHome(container2, { getUser: getUser2 }) {
  const user = getUser2();
  const firstName = (user?.name ?? "there").split(" ")[0];
  container2.innerHTML = `
    <div class="home-screen">
      <div class="home-hud">
        <p class="home-greeting">${t("home.greeting", { name: escapeHtml(firstName) })}</p>
        <span id="home-status-chip" class="home-status-chip"></span>
      </div>

      <div class="panic-wrap">
        <button id="panic-btn" class="panic-btn" type="button" aria-label="${t("home.panicAria")}">
          <svg class="panic-ring" viewBox="0 0 120 120">
            <circle class="panic-ring-bg" cx="60" cy="60" r="${RING_RADIUS}"></circle>
            <circle id="panic-ring-progress" class="panic-ring-progress" cx="60" cy="60" r="${RING_RADIUS}"
                    stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${RING_CIRCUMFERENCE}"></circle>
          </svg>
          <span id="panic-icon" class="panic-icon">SOS</span>
          <svg id="panic-check" class="panic-check" viewBox="0 0 24 24" hidden>
            <polyline points="4 12 9 18 20 6"></polyline>
          </svg>
        </button>
        <p id="panic-status" class="panic-status" aria-live="polite">${t("home.idle")}</p>
      </div>
    </div>
  `;
  const btn = container2.querySelector("#panic-btn");
  const ring = container2.querySelector("#panic-ring-progress");
  const icon2 = container2.querySelector("#panic-icon");
  const check = container2.querySelector("#panic-check");
  const status = container2.querySelector("#panic-status");
  const statusChip = container2.querySelector("#home-status-chip");
  let notifiableCount = null;
  loadStatusChip(statusChip, (count) => {
    notifiableCount = count;
  });
  let holding = false;
  let busy = false;
  let holdStart = 0;
  let rafId = null;
  function setRingProgress(progress) {
    ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
    btn.style.setProperty("--hold", String(progress));
  }
  function tick() {
    const progress = Math.min((performance.now() - holdStart) / HOLD_DURATION_MS, 1);
    setRingProgress(progress);
    if (progress >= 1) {
      holding = false;
      sendAlert();
      return;
    }
    if (holding)
      rafId = requestAnimationFrame(tick);
  }
  function startHold() {
    if (busy || holding)
      return;
    holding = true;
    holdStart = performance.now();
    btn.classList.add("panic-btn-holding");
    status.textContent = t("home.holding");
    rafId = requestAnimationFrame(tick);
  }
  function cancelHold() {
    if (!holding)
      return;
    holding = false;
    cancelAnimationFrame(rafId);
    btn.classList.remove("panic-btn-holding");
    setRingProgress(0);
    status.textContent = t("home.idle");
  }
  async function sendAlert() {
    if (notifiableCount === 0) {
      btn.classList.remove("panic-btn-holding");
      setRingProgress(0);
      status.textContent = t("home.idle");
      showToast(t("home.noContacts"), "error");
      shake(btn);
      return;
    }
    busy = true;
    btn.classList.remove("panic-btn-holding");
    btn.classList.add("panic-btn-busy");
    status.textContent = t("home.locating");
    try {
      const { latitude, longitude } = await getCurrentCoordinates();
      status.textContent = t("home.sending");
      await Api.createAlert({ latitude, longitude });
      btn.classList.remove("panic-btn-busy");
      btn.classList.add("panic-btn-success");
      icon2.hidden = true;
      check.hidden = false;
      status.textContent = t("home.sent");
      showToast(t("home.sentToast"), "success");
    } catch (error) {
      btn.classList.remove("panic-btn-busy");
      btn.classList.add("panic-btn-error");
      const message = error instanceof Error ? error.message : t("home.errorFallback");
      status.textContent = message;
      showToast(message, "error");
      shake(btn);
    } finally {
      setTimeout(resetButton, RESET_DELAY_MS);
    }
  }
  function resetButton() {
    busy = false;
    setRingProgress(0);
    btn.classList.remove("panic-btn-busy", "panic-btn-success", "panic-btn-error");
    icon2.hidden = false;
    check.hidden = true;
    status.textContent = t("home.idle");
  }
  const TILT_MAX_DEG = 8;
  function applyTilt(event) {
    const rect = btn.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const scale = holding ? 0.98 : 1;
    btn.style.transform = `perspective(600px) rotateX(${(-dy * TILT_MAX_DEG).toFixed(2)}deg) rotateY(${(dx * TILT_MAX_DEG).toFixed(2)}deg) scale(${scale})`;
  }
  function resetTilt() {
    btn.style.transform = "";
  }
  btn.addEventListener("pointerdown", startHold);
  btn.addEventListener("pointerup", cancelHold);
  btn.addEventListener("pointerleave", cancelHold);
  btn.addEventListener("pointercancel", cancelHold);
  btn.addEventListener("pointermove", applyTilt);
  btn.addEventListener("pointerleave", resetTilt);
}
async function loadStatusChip(chip, onCount) {
  try {
    const contacts = await Api.listContacts();
    const notifiable = contacts.filter((contact) => contact.confirmed || contact.telegram_linked).length;
    onCount(notifiable);
    chip.innerHTML = notifiable > 0 ? `${Icon.contacts()} ${t(notifiable === 1 ? "home.statusReady" : "home.statusReadyPlural", { count: notifiable })}` : `${Icon.contacts()} ${t("home.statusNone")}`;
    chip.classList.add("home-status-visible");
  } catch {}
}

// src/lib/features.js
var cached = null;
function getFeatures() {
  if (!cached) {
    cached = Api.getFeatures().catch(() => ({ telegram: false, whatsapp: false }));
  }
  return cached;
}

// node_modules/@capacitor-community/contacts/dist/esm/index.js
init_dist();

// node_modules/@capacitor-community/contacts/dist/esm/definitions.js
var PhoneType;
(function(PhoneType2) {
  PhoneType2["Home"] = "home";
  PhoneType2["Work"] = "work";
  PhoneType2["Other"] = "other";
  PhoneType2["Custom"] = "custom";
  PhoneType2["Mobile"] = "mobile";
  PhoneType2["FaxWork"] = "fax_work";
  PhoneType2["FaxHome"] = "fax_home";
  PhoneType2["Pager"] = "pager";
  PhoneType2["Callback"] = "callback";
  PhoneType2["Car"] = "car";
  PhoneType2["CompanyMain"] = "company_main";
  PhoneType2["Isdn"] = "isdn";
  PhoneType2["Main"] = "main";
  PhoneType2["OtherFax"] = "other_fax";
  PhoneType2["Radio"] = "radio";
  PhoneType2["Telex"] = "telex";
  PhoneType2["TtyTdd"] = "tty_tdd";
  PhoneType2["WorkMobile"] = "work_mobile";
  PhoneType2["WorkPager"] = "work_pager";
  PhoneType2["Assistant"] = "assistant";
  PhoneType2["Mms"] = "mms";
})(PhoneType || (PhoneType = {}));
var EmailType;
(function(EmailType2) {
  EmailType2["Home"] = "home";
  EmailType2["Work"] = "work";
  EmailType2["Other"] = "other";
  EmailType2["Custom"] = "custom";
  EmailType2["Mobile"] = "mobile";
})(EmailType || (EmailType = {}));
var PostalAddressType;
(function(PostalAddressType2) {
  PostalAddressType2["Home"] = "home";
  PostalAddressType2["Work"] = "work";
  PostalAddressType2["Other"] = "other";
  PostalAddressType2["Custom"] = "custom";
})(PostalAddressType || (PostalAddressType = {}));

// node_modules/@capacitor-community/contacts/dist/esm/index.js
var Contacts = registerPlugin("Contacts", {
  web: () => Promise.resolve().then(() => (init_web5(), exports_web5)).then((m) => new m.ContactsWeb)
});

// src/lib/contactsPicker.js
async function pickDeviceContact() {
  const { contact } = await Contacts.pickContact({
    projection: { name: true, phones: true, emails: true }
  });
  return {
    name: contact.name?.display ?? "",
    phone: contact.phones?.[0]?.number ?? "",
    email: contact.emails?.[0]?.address ?? ""
  };
}

// src/lib/sheet.js
function openSheet(bodyElement) {
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.appendChild(bodyElement);
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
  function close() {
    backdrop.classList.remove("sheet-open");
    backdrop.addEventListener("transitionend", () => backdrop.remove(), { once: true });
  }
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop)
      close();
  });
  requestAnimationFrame(() => backdrop.classList.add("sheet-open"));
  return { close, sheet };
}

// src/views/contacts.js
var EMAIL_DOMAINS2 = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"];
var MAX_CONTACTS = 4;
function insertEmailDomain2(input, domain) {
  const at = input.value.indexOf("@");
  const local = at >= 0 ? input.value.slice(0, at) : input.value;
  input.value = `${local}@${domain}`;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}
async function renderContacts(container2) {
  container2.innerHTML = `
    <div class="contacts-screen">
      <div id="contacts-list" class="contacts-list"></div>
      <button id="add-contact-fab" class="fab" type="button" aria-label="${t("contacts.addTitle")}">${Icon.add()}</button>
    </div>
  `;
  const list = container2.querySelector("#contacts-list");
  const fab = container2.querySelector("#add-contact-fab");
  renderSkeleton(list);
  const features = await getFeatures();
  await loadContacts(list, fab, features);
  fab.addEventListener("click", () => {
    if (fab.dataset.atLimit === "true") {
      showToast(t("contacts.limitReached", { max: MAX_CONTACTS }), "info");
      return;
    }
    openAddOptionsSheet(() => loadContacts(list, fab, features), features);
  });
}
function updateFabState(fab, count) {
  const atLimit = count >= MAX_CONTACTS;
  fab.dataset.atLimit = String(atLimit);
  fab.classList.toggle("fab-disabled", atLimit);
  fab.setAttribute("aria-disabled", String(atLimit));
}
function renderSkeleton(list) {
  list.innerHTML = Array.from({ length: 3 }).map(() => `<div class="contact-row contact-skeleton"></div>`).join("");
}
async function loadContacts(list, fab, features) {
  try {
    const contacts = await Api.listContacts();
    renderContactRows(list, fab, contacts, features);
    updateFabState(fab, contacts.length);
  } catch (error) {
    list.innerHTML = `<p class="contacts-empty">${t("contacts.loadError")}</p>`;
    showToast(error instanceof ApiError ? error.message : t("contacts.loadErrorToast"), "error");
  }
}
function renderContactRows(list, fab, contacts, features) {
  if (contacts.length === 0) {
    list.innerHTML = `<p class="contacts-empty">${t("contacts.empty")}</p>`;
    return;
  }
  const limitHint = contacts.length >= MAX_CONTACTS ? `<p class="contacts-limit-hint">${t("contacts.limitReached", { max: MAX_CONTACTS })}</p>` : "";
  list.innerHTML = limitHint + contacts.map((contact, index) => `
      <button class="contact-row" type="button" data-id="${contact.id}" style="animation-delay:${index * 60}ms">
        <span class="contact-avatar">${escapeHtml(contact.name.charAt(0).toUpperCase())}</span>
        <span class="contact-info">
          <span class="contact-name">${escapeHtml(contact.name)}</span>
          <span class="contact-phone">${Icon.phone()} ${escapeHtml(contact.phone)}</span>
          ${contact.email ? `<span class="contact-email">${Icon.mail()} ${escapeHtml(contact.email)}</span>` : ""}
        </span>
        <span class="contact-channels">
          <span class="channel-icon ${contact.confirmed ? "channel-active" : "channel-inactive"}"
                title="${contact.confirmed ? t("contacts.confirmed") : t("contacts.pending")}"
                aria-label="${contact.confirmed ? t("contacts.confirmed") : t("contacts.pending")}">${Icon.mail()}</span>
          ${features.telegram ? `<span class="channel-icon channel-telegram ${contact.telegram_linked ? "channel-active" : "channel-inactive"}"
                       title="${contact.telegram_linked ? t("contacts.telegramLinked") : t("contacts.telegramNotLinked")}"
                       aria-label="${contact.telegram_linked ? t("contacts.telegramLinked") : t("contacts.telegramNotLinked")}">${Icon.telegram()}</span>` : ""}
          ${features.whatsapp ? `<span class="channel-icon channel-whatsapp ${contact.whatsapp_enabled && contact.whatsapp_confirmed ? "channel-active" : "channel-inactive"}"
                       title="${contact.whatsapp_enabled && contact.whatsapp_confirmed ? t("contacts.whatsappLinked") : t("contacts.whatsappNotLinked")}"
                       aria-label="${contact.whatsapp_enabled && contact.whatsapp_confirmed ? t("contacts.whatsappLinked") : t("contacts.whatsappNotLinked")}">${Icon.whatsapp()}</span>` : ""}
        </span>
      </button>
    `).join("");
  list.querySelectorAll(".contact-row").forEach((row) => {
    row.addEventListener("click", () => {
      const contact = contacts.find((c) => String(c.id) === row.dataset.id);
      openContactFormSheet({ contact, features, onSaved: () => loadContacts(list, fab, features) });
    });
  });
}
function openAddOptionsSheet(onSaved, features) {
  const body = document.createElement("div");
  body.innerHTML = `
    <h2 class="sheet-title">${t("contacts.addTitle")}</h2>
    <div class="sheet-options">
      <button class="btn btn-outline btn-block" type="button" id="pick-device-contact">
        ${Icon.contacts()}
        <span class="btn-label">${t("contacts.pickDevice")}</span>
      </button>
      <button class="btn btn-outline btn-block" type="button" id="add-manually">
        ${Icon.personAdd()}
        <span class="btn-label">${t("contacts.addManually")}</span>
      </button>
    </div>
  `;
  const { close } = openSheet(body);
  body.querySelector("#add-manually").addEventListener("click", () => {
    close();
    openContactFormSheet({ onSaved, features });
  });
  body.querySelector("#pick-device-contact").addEventListener("click", async () => {
    close();
    try {
      const prefill = await pickDeviceContact();
      openContactFormSheet({ prefill, onSaved, features });
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("contacts.pickError"), "error");
    }
  });
}
function openContactFormSheet({ contact = null, prefill = null, features, onSaved }) {
  const isEdit = Boolean(contact);
  const initial = contact ?? prefill ?? { name: "", phone: "", email: "" };
  const { countryCode, number } = splitPhone(initial.phone);
  const body = document.createElement("div");
  body.innerHTML = `
    <form class="form sheet-form" novalidate>
      <h2 class="sheet-title">${isEdit ? t("contacts.editTitle") : t("contacts.addTitle")}</h2>
      <label class="field">
        <span>${t("contacts.name")}</span>
        <input type="text" name="name" required value="${escapeHtml(initial.name ?? "")}" />
      </label>
      <label class="field">
        <span>${t("contacts.phone")}</span>
        <div class="phone-field">
          <select name="phone_country" class="phone-country">${buildCountryCodeOptions(countryCode)}</select>
          <input type="tel" name="phone_number" inputmode="numeric" required value="${escapeHtml(number)}" />
        </div>
      </label>
      <label class="field">
        <span>${t("contacts.email")}</span>
        <input type="email" name="email" required value="${escapeHtml(initial.email ?? "")}" />
        <div class="email-domain-chips">
          ${EMAIL_DOMAINS2.map((domain) => `<button type="button" class="email-domain-chip" data-domain="${domain}">@${domain}</button>`).join("")}
        </div>
      </label>
      ${!isEdit ? `<p class="field-hint">${t("contacts.emailHint")}</p>` : ""}
      <button type="submit" class="btn btn-primary btn-block">
        <span class="btn-label">${isEdit ? t("contacts.save") : t("contacts.add")}</span>
        <span class="btn-spinner" hidden></span>
      </button>
      ${isEdit && contact.email && !contact.confirmed ? `<button type="button" class="btn btn-outline btn-block" id="resend-confirmation">
              ${Icon.mail()}
              <span class="btn-label">${t("contacts.resendConfirmation")}</span>
              <span class="btn-spinner" hidden></span>
            </button>` : ""}
      ${isEdit && features.telegram ? `<button type="button" class="btn btn-outline btn-block" id="telegram-toggle">
              ${Icon.telegram()}
              <span class="btn-label">${contact.telegram_linked ? t("contacts.telegramDisconnect") : t("contacts.telegramConnect")}</span>
              <span class="btn-spinner" hidden></span>
            </button>` : ""}
      ${isEdit && features.whatsapp ? `<button type="button" class="btn btn-outline btn-block" id="whatsapp-toggle">
              ${Icon.whatsapp()}
              <span class="btn-label">${contact.whatsapp_enabled ? t("contacts.whatsappDisconnect") : t("contacts.whatsappConnect")}</span>
              <span class="btn-spinner" hidden></span>
            </button>` : ""}
      ${isEdit ? `<button type="button" class="btn btn-danger-outline btn-block" id="delete-contact">
              ${Icon.delete()}
              <span class="btn-label">${t("contacts.delete")}</span>
              <span class="btn-spinner" hidden></span>
            </button>` : ""}
    </form>
  `;
  const { close } = openSheet(body);
  const form = body.querySelector("form");
  const button = form.querySelector('button[type="submit"]');
  attachPhoneSanitizer(form.querySelector('input[name="phone_number"]'));
  const emailInput = form.querySelector('input[name="email"]');
  form.querySelectorAll(".email-domain-chip").forEach((chip) => {
    chip.addEventListener("click", () => insertEmailDomain2(emailInput, chip.dataset.domain));
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(form));
    const data = {
      name: formData.name,
      phone: combinePhone(formData.phone_country, formData.phone_number),
      email: formData.email.trim()
    };
    if (!data.email) {
      shake(form);
      showToast(t("contacts.emailRequired"), "error");
      return;
    }
    setLoading(button, true);
    try {
      if (isEdit) {
        const changes = diffFields(contact, data);
        if (Object.keys(changes).length === 0) {
          close();
          return;
        }
        await Api.updateContact(contact.id, changes);
        showToast(t("contacts.updated"), "success");
      } else {
        await Api.createContact(data);
        showToast(t("contacts.addedWithEmail"), "success");
      }
      close();
      onSaved();
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : t("errors.generic"), "error");
    } finally {
      setLoading(button, false);
    }
  });
  if (isEdit) {
    const resendButton = body.querySelector("#resend-confirmation");
    resendButton?.addEventListener("click", async () => {
      setLoading(resendButton, true);
      try {
        await Api.resendContactConfirmation(contact.id);
        showToast(t("contacts.resendConfirmationSent"), "success");
        close();
      } catch (error) {
        showToast(error instanceof ApiError ? error.message : t("errors.generic"), "error");
      } finally {
        setLoading(resendButton, false);
      }
    });
    const telegramButton = body.querySelector("#telegram-toggle");
    telegramButton?.addEventListener("click", async () => {
      setLoading(telegramButton, true);
      try {
        if (contact.telegram_linked) {
          await Api.disableContactTelegram(contact.id);
          showToast(t("contacts.telegramDisconnected"), "success");
        } else {
          const result = await Api.enableContactTelegram(contact.id);
          if (result.telegram_link_url) {
            try {
              await navigator.clipboard.writeText(result.telegram_link_url);
            } catch {}
            showToast(t("contacts.telegramLinkReady"), "success");
          } else {
            showToast(t("contacts.telegramEmailSent"), "success");
          }
        }
        close();
        onSaved();
      } catch (error) {
        const fallbackKey = contact.telegram_linked ? "contacts.telegramDisableError" : "contacts.telegramEnableError";
        showToast(error instanceof ApiError ? error.message : t(fallbackKey), "error");
      } finally {
        setLoading(telegramButton, false);
      }
    });
    const whatsappButton = body.querySelector("#whatsapp-toggle");
    whatsappButton?.addEventListener("click", async () => {
      setLoading(whatsappButton, true);
      try {
        if (contact.whatsapp_enabled) {
          await Api.disableContactWhatsapp(contact.id);
          showToast(t("contacts.whatsappDisconnected"), "success");
        } else {
          const result = await Api.enableContactWhatsapp(contact.id);
          if (result.join_url) {
            try {
              await navigator.clipboard.writeText(result.join_url);
            } catch {}
            showToast(t("contacts.whatsappLinkReady"), "success");
          } else {
            showToast(t("contacts.whatsappEnabled"), "success");
          }
        }
        close();
        onSaved();
      } catch (error) {
        const fallbackKey = contact.whatsapp_enabled ? "contacts.whatsappDisableError" : "contacts.whatsappEnableError";
        showToast(error instanceof ApiError ? error.message : t(fallbackKey), "error");
      } finally {
        setLoading(whatsappButton, false);
      }
    });
    const deleteButton = body.querySelector("#delete-contact");
    deleteButton.addEventListener("click", async () => {
      if (!confirm(t("contacts.removeConfirm", { name: contact.name })))
        return;
      setLoading(deleteButton, true);
      try {
        await Api.deleteContact(contact.id);
        showToast(t("contacts.removed"), "success");
        close();
        onSaved();
      } catch (error) {
        showToast(error instanceof ApiError ? error.message : t("contacts.removeError"), "error");
      } finally {
        setLoading(deleteButton, false);
      }
    });
  }
}
function diffFields(original, updated) {
  const changes = {};
  for (const key of ["name", "phone", "email"]) {
    if ((original[key] ?? null) !== (updated[key] ?? null)) {
      changes[key] = updated[key];
    }
  }
  return changes;
}

// src/views/profile.js
var COLOR_PRESETS = [DEFAULT_ACCENT, "#2563eb", "#16a34a", "#9333ea", "#f97316", "#0d9488"];
async function renderProfile(container2, { getUser: getUser2, refreshUser, logout, navigate, getLanguage: getLanguage2, changeLanguage, getAccentColor: getAccentColor2, setAccentColor: setAccentColor2, getTheme: getTheme2, setTheme: setTheme2 }) {
  const user = getUser2();
  const lang = getLanguage2();
  const accentColor = getAccentColor2();
  const isPreset = COLOR_PRESETS.includes(accentColor);
  const theme = getTheme2();
  container2.innerHTML = `
    <div class="profile-screen">
      <div class="profile-avatar">${escapeHtml((user?.name ?? "?").charAt(0).toUpperCase())}</div>

      <form id="profile-form" class="form" novalidate>
        <label class="field">
          <span>${t("profile.name")}</span>
          <input type="text" name="name" required value="${escapeHtml(user?.name ?? "")}" />
        </label>
        <label class="field">
          <span>${t("profile.phone")}</span>
          <input type="tel" name="phone" required value="${escapeHtml(user?.phone ?? "")}" />
        </label>
        <label class="field">
          <span>${t("profile.email")}</span>
          <input type="email" name="email" required value="${escapeHtml(user?.email ?? "")}" />
        </label>
        <label class="field">
          <span>${t("profile.newPassword")}</span>
          <input type="password" name="password" autocomplete="new-password" placeholder="${t("profile.newPasswordPlaceholder")}" />
        </label>
        <label class="field">
          <span>${t("profile.currentPassword")}</span>
          <input type="password" name="current_password" autocomplete="current-password" placeholder="${t("profile.currentPasswordPlaceholder")}" />
          <small class="field-hint">${t("profile.currentPasswordHint")}</small>
        </label>
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-label">${t("profile.save")}</span>
          <span class="btn-spinner" hidden></span>
        </button>
      </form>

      <div class="lang-switcher">
        <span class="lang-switcher-label">${Icon.language()} ${t("profile.language")}</span>
        <select id="lang-select" class="lang-select">
          ${LANGUAGES.map((l) => `<option value="${l.code}" ${l.code === lang ? "selected" : ""}>${escapeHtml(l.label)}</option>`).join("")}
        </select>
      </div>

      <div class="lang-switcher">
        <span class="lang-switcher-label">${Icon.theme()} ${t("profile.theme")}</span>
        <select id="theme-select" class="lang-select">
          <option value="auto" ${theme === "auto" ? "selected" : ""}>${t("profile.themeAuto")}</option>
          <option value="light" ${theme === "light" ? "selected" : ""}>${t("profile.themeLight")}</option>
          <option value="dark" ${theme === "dark" ? "selected" : ""}>${t("profile.themeDark")}</option>
        </select>
      </div>

      <div class="color-switcher">
        <span class="lang-switcher-label">${Icon.palette()} ${t("profile.color")}</span>
        <div class="color-swatches">
          ${COLOR_PRESETS.map((hex) => `
            <button type="button" class="color-swatch ${!isPreset ? "" : hex === accentColor ? "color-swatch-active" : ""}"
                    data-color="${hex}" style="background:${hex}" aria-label="${hex}"></button>
          `).join("")}
          <label class="color-swatch color-swatch-custom ${!isPreset ? "color-swatch-active" : ""}"
                 style="background:${!isPreset ? accentColor : "conic-gradient(from 0deg, red, orange, yellow, green, blue, violet, red)"}"
                 title="${t("profile.colorCustom")}">
            <input type="color" id="color-custom-input" value="${accentColor}" />
          </label>
        </div>
      </div>

      <button id="help-btn" class="btn btn-outline btn-block" type="button">
        ${Icon.help()}
        <span class="btn-label">${t("profile.help")}</span>
      </button>

      <button id="about-btn" class="btn btn-outline btn-block" type="button">
        ${Icon.info()}
        <span class="btn-label">${t("profile.about")}</span>
      </button>

      <button id="logout-btn" class="btn btn-outline btn-block" type="button">
        ${Icon.logout()}
        <span class="btn-label">${t("profile.logout")}</span>
      </button>
    </div>
  `;
  const form = container2.querySelector("#profile-form");
  const button = form.querySelector("button[type=submit]");
  const logoutBtn = container2.querySelector("#logout-btn");
  container2.querySelector("#lang-select").addEventListener("change", (event) => changeLanguage(event.target.value));
  container2.querySelector("#theme-select").addEventListener("change", (event) => setTheme2(event.target.value));
  const customSwatch = container2.querySelector(".color-swatch-custom");
  const customInput = container2.querySelector("#color-custom-input");
  function markActiveSwatch(hex) {
    container2.querySelectorAll(".color-swatch[data-color]").forEach((swatch) => {
      swatch.classList.toggle("color-swatch-active", swatch.dataset.color === hex);
    });
    const isCustom = !COLOR_PRESETS.includes(hex);
    customSwatch.classList.toggle("color-swatch-active", isCustom);
    if (isCustom)
      customSwatch.style.background = hex;
  }
  container2.querySelectorAll(".color-swatch[data-color]").forEach((swatch) => {
    swatch.addEventListener("click", () => {
      setAccentColor2(swatch.dataset.color);
      markActiveSwatch(swatch.dataset.color);
    });
  });
  customInput.addEventListener("input", () => {
    setAccentColor2(customInput.value);
    markActiveSwatch(customInput.value);
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.password)
      delete data.password;
    const changes = {};
    for (const key of ["name", "phone", "email", "password"]) {
      if (data[key] !== undefined && data[key] !== (user?.[key] ?? "")) {
        changes[key] = data[key];
      }
    }
    if (Object.keys(changes).length === 0) {
      showToast(t("profile.noChanges"), "info");
      return;
    }
    const sensitive = "email" in changes || "password" in changes;
    if (sensitive) {
      if (!data.current_password) {
        shake(form);
        showToast(t("profile.currentPasswordRequired"), "error");
        return;
      }
      changes.current_password = data.current_password;
    }
    setLoading(button, true);
    try {
      await Api.updateMe(changes);
      await refreshUser();
      form.querySelector("input[name=password]").value = "";
      form.querySelector("input[name=current_password]").value = "";
      showToast(t("profile.updated"), "success");
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : t("errors.generic"), "error");
    } finally {
      setLoading(button, false);
    }
  });
  logoutBtn.addEventListener("click", () => logout());
  container2.querySelector("#help-btn").addEventListener("click", () => navigate("help"));
  container2.querySelector("#about-btn").addEventListener("click", () => navigate("about"));
}

// src/views/about.js
async function renderAbout(container2, { navigate }) {
  container2.innerHTML = `
    <div class="info-screen">
      <div class="info-header">
        <button class="icon-btn" type="button" id="info-back" aria-label="${t("info.back")}">${Icon.arrowBack()}</button>
        <h1 class="info-title">${t("route.about.title")}</h1>
      </div>

      <img class="about-mark" src="assets/brand-mark.png" alt="" />

      <section class="info-section">
        <p class="info-section-body">${t("about.description")}</p>
      </section>

      <section class="info-section">
        <p class="about-credit">${t("about.developedBy")}</p>
        <p class="about-credit">${t("about.rights")}</p>
        <p class="about-credit about-version">${t("about.version")}</p>
      </section>
    </div>
  `;
  container2.querySelector("#info-back").addEventListener("click", () => navigate("profile"));
}

// src/views/help.js
var SECTIONS = ["account", "panic", "contacts", "channels", "profile"];
async function renderHelp(container2, { navigate }) {
  container2.innerHTML = `
    <div class="info-screen">
      <div class="info-header">
        <button class="icon-btn" type="button" id="info-back" aria-label="${t("info.back")}">${Icon.arrowBack()}</button>
        <h1 class="info-title">${t("route.help.title")}</h1>
      </div>
      <p class="info-intro">${t("help.intro")}</p>
      ${SECTIONS.map((key) => `
        <section class="info-section">
          <h2 class="info-section-title">${t(`help.section.${key}.title`)}</h2>
          <p class="info-section-body">${t(`help.section.${key}.body`)}</p>
        </section>
      `).join("")}
    </div>
  `;
  container2.querySelector("#info-back").addEventListener("click", () => navigate("profile"));
}

// src/main.js
var viewEl = document.getElementById("view");
var bottomNav = document.getElementById("bottom-nav");
var navTabs = [...document.querySelectorAll("#bottom-nav .nav-tab")];
var ROUTES = {
  login: { render: renderLogin, titleKey: "route.login.title", public: true },
  register: { render: renderRegister, titleKey: "route.register.title", public: true },
  home: { render: renderHome, title: "Panic Button", public: false },
  contacts: { render: renderContacts, titleKey: "route.contacts.title", public: false },
  profile: { render: renderProfile, titleKey: "route.profile.title", public: false },
  about: { render: renderAbout, titleKey: "route.about.title", public: false },
  help: { render: renderHelp, titleKey: "route.help.title", public: false }
};
function applyStaticLabels() {
  navTabs.forEach((tab) => {
    tab.querySelector(".nav-tab-label").textContent = t(`nav.${tab.dataset.route}`);
  });
  const activeRoute = ROUTES[currentRouteName()];
  if (activeRoute) {
    document.title = activeRoute.title ?? t(activeRoute.titleKey);
  }
}
async function changeLanguage(lang) {
  if (lang === getLanguage())
    return;
  await setLanguage(lang);
  applyStaticLabels();
  await renderCurrentRoute();
}
function navigate(route) {
  window.location.hash = `#/${route}`;
}
async function logout() {
  await clearToken();
  navigate("login");
}
async function refreshUser() {
  const user = await Api.getMe();
  setUser(user);
  return user;
}
function currentRouteName() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return ROUTES[hash] ? hash : null;
}
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function renderCurrentRoute() {
  const loggedIn = Boolean(getUser());
  let name = currentRouteName();
  if (!name) {
    window.location.hash = `#/${loggedIn ? "home" : "login"}`;
    return;
  }
  const route = ROUTES[name];
  if (route.public && loggedIn) {
    window.location.hash = "#/home";
    return;
  }
  if (!route.public && !loggedIn) {
    window.location.hash = "#/login";
    return;
  }
  document.title = route.title ?? t(route.titleKey);
  bottomNav.classList.toggle("hidden", route.public);
  navTabs.forEach((tab) => tab.classList.toggle("nav-tab-active", tab.dataset.route === name));
  viewEl.classList.remove("view-visible");
  await wait(140);
  viewEl.innerHTML = "";
  await route.render(viewEl, {
    navigate,
    logout,
    getUser,
    refreshUser,
    getLanguage,
    changeLanguage,
    getAccentColor,
    setAccentColor,
    getTheme,
    setTheme
  });
  requestAnimationFrame(() => viewEl.classList.add("view-visible"));
}
window.addEventListener("hashchange", renderCurrentRoute);
navTabs.forEach((tab) => tab.addEventListener("click", () => navigate(tab.dataset.route)));
async function boot() {
  initAppUpdates();
  await loadLanguage();
  await loadTheme();
  await loadAccentColor();
  applyStaticLabels();
  const token = await getToken();
  if (token) {
    try {
      await refreshUser();
    } catch {
      await clearToken();
    }
  }
  await renderCurrentRoute();
  await SplashScreen.hide();
}
boot();
