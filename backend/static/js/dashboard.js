const THEME_KEY = "panicbutton.site.theme";
const COLOR_KEY = "panicbutton.dashboard.accentColor";
const DEFAULT_ACCENT = "#ea2052";
const COLOR_PRESETS = ["#ea2052", "#2563eb", "#16a34a", "#9333ea", "#f97316", "#0d9488"];

const SHADE_LIGHTNESS = {
  dark:  { 900: 0.3, 700: 0.45, 600: 0.5, 500: 0.55, 400: 0.65 },
  light: { 900: 0.3, 700: 0.45, 600: 0.5, 500: 0.55, 400: 0.46 },
};

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4;
  }
  return { h: h / 6, s, l };
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function toHex(r, g, b) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function hslToHex(h, s, l) {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return toHex(gray, gray, gray);
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return toHex(
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  );
}

const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
let currentAccent = DEFAULT_ACCENT;
let currentTheme = "auto";

function resolvedScheme() {
  if (currentTheme === "light" || currentTheme === "dark") return currentTheme;
  return media && !media.matches ? "light" : "dark";
}

function applyAccentColor(hex) {
  currentAccent = hex;
  const { r, g, b } = hexToRgb(hex);
  const { h, s } = rgbToHsl(r, g, b);
  const mode = resolvedScheme();
  const root = document.documentElement.style;
  for (const [shade, l] of Object.entries(SHADE_LIGHTNESS[mode])) {
    root.setProperty(`--primary-${shade}`, hslToHex(h, s, l));
  }
  root.setProperty("--primary-rgb", `${r}, ${g}, ${b}`);
}

function applyTheme(theme) {
  currentTheme = ["auto", "light", "dark"].includes(theme) ? theme : "auto";
  document.documentElement.dataset.theme = currentTheme;
  applyAccentColor(currentAccent);
}

function markActiveSwatch(hex) {
  document.querySelectorAll(".settings-swatch[data-color]").forEach((swatch) => {
    swatch.classList.toggle("settings-swatch-active", swatch.dataset.color === hex);
  });
  const isCustom = !COLOR_PRESETS.includes(hex);
  const customSwatch = document.getElementById("color-swatch-custom");
  customSwatch.classList.toggle("settings-swatch-active", isCustom);
  if (isCustom) customSwatch.style.background = hex;
}

function initSettings() {
  applyTheme(localStorage.getItem(THEME_KEY) || "auto");
  document.getElementById("theme-select").value = currentTheme;

  const savedAccent = localStorage.getItem(COLOR_KEY) || DEFAULT_ACCENT;
  applyAccentColor(savedAccent);
  document.getElementById("color-custom-input").value = savedAccent;
  markActiveSwatch(savedAccent);

  document.getElementById("theme-select").addEventListener("change", (event) => {
    localStorage.setItem(THEME_KEY, event.target.value);
    applyTheme(event.target.value);
  });

  document.querySelectorAll(".settings-swatch[data-color]").forEach((swatch) => {
    swatch.addEventListener("click", () => {
      localStorage.setItem(COLOR_KEY, swatch.dataset.color);
      applyAccentColor(swatch.dataset.color);
      markActiveSwatch(swatch.dataset.color);
    });
  });

  const customInput = document.getElementById("color-custom-input");
  customInput.addEventListener("input", () => {
    localStorage.setItem(COLOR_KEY, customInput.value);
    applyAccentColor(customInput.value);
    markActiveSwatch(customInput.value);
  });

  if (media) {
    media.addEventListener("change", () => applyAccentColor(currentAccent));
  }

  const settingsDialog = document.getElementById("settings-dialog");
  document.getElementById("settings-btn").addEventListener("click", () => settingsDialog.showModal());
  settingsDialog.addEventListener("click", (event) => {
    if (event.target === settingsDialog) settingsDialog.close();
  });
}

initSettings();

let token = sessionStorage.getItem("pb_token");

const loginView = document.getElementById("login-view");
const dashView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const alertsList = document.getElementById("alerts-list");
const logoutBtn = document.getElementById("logout-btn");

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function showDashboard() {
  loginView.hidden = true;
  dashView.hidden = false;
  loadAlerts();
}

function showLogin(message) {
  sessionStorage.removeItem("pb_token");
  token = null;
  loginView.hidden = false;
  dashView.hidden = true;
  loginError.hidden = !message;
  if (message) loginError.textContent = message;
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) {
    showLogin("Your session expired. Log in again.");
    throw new Error("unauthorized");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : "Something went wrong.");
  }
  return response.status === 204 ? null : response.json();
}

function channelLabel(channel) {
  return channel === "telegram" ? "Telegram" : "Email";
}

async function loadAlerts() {
  alertsList.innerHTML = `<p class="empty">Loading...</p>`;
  try {
    const alerts = await api("/alerts");
    if (alerts.length === 0) {
      alertsList.innerHTML = `<p class="empty">No alerts have been triggered yet.</p>`;
      return;
    }
    alertsList.innerHTML = alerts
      .map(
        (alert) => `
      <div class="alert-card">
        <div class="alert-header">
          <span class="alert-time">${escapeHtml(alert.created_at)}</span>
        </div>
        <a class="alert-coords" href="https://www.google.com/maps?q=${alert.latitude},${alert.longitude}" target="_blank" rel="noopener">${alert.latitude}, ${alert.longitude}</a>
        <div class="notifications">
          ${
            alert.notifications.length === 0
              ? `<p class="no-notifications">No confirmed contacts were notified for this alert.</p>`
              : alert.notifications
                  .map(
                    (notification) => `
                <div class="notification-row">
                  <span class="channel-tag channel-${notification.channel}">${channelLabel(notification.channel)}</span>
                  <span class="contact-name">${escapeHtml(notification.contact_name)}</span>
                  <span class="view-status ${notification.viewed_at ? "viewed" : "pending"}">
                    ${notification.viewed_at ? `Seen ${escapeHtml(notification.viewed_at)}` : "Not seen yet"}
                  </span>
                </div>
              `
                  )
                  .join("")
          }
        </div>
      </div>
    `
      )
      .join("");
  } catch (error) {
    if (error.message !== "unauthorized") {
      alertsList.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
    }
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  const data = Object.fromEntries(new FormData(loginForm));
  try {
    const result = await api("/auth/login", { method: "POST", body: JSON.stringify(data) });
    token = result.access_token;
    sessionStorage.setItem("pb_token", token);
    showDashboard();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  }
});

logoutBtn.addEventListener("click", () => showLogin());

if (token) {
  showDashboard();
} else {
  showLogin();
}
