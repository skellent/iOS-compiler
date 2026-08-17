import { Preferences } from "@capacitor/preferences";

const COLOR_KEY = "panicbutton.accentColor";
const THEME_KEY = "panicbutton.theme";
export const DEFAULT_ACCENT = "#ea2052";
export const DEFAULT_THEME = "auto";
export const THEMES = ["auto", "light", "dark"];

const SHADE_LIGHTNESS = {
  dark:  { 900: 0.3, 800: 0.38, 700: 0.45, 600: 0.5, 500: 0.55, 400: 0.65, 300: 0.78 },
  light: { 900: 0.3, 800: 0.38, 700: 0.45, 600: 0.5, 500: 0.55, 400: 0.46, 300: 0.4 },
};
const ALPHA = {
  dark:  { glow: 0.55, tint: 0.14 },
  light: { glow: 0.35, tint: 0.14 },
};

let currentAccent = DEFAULT_ACCENT;
let currentTheme = DEFAULT_THEME;
const _media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

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

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
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

function toHex(r, g, b) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function scheme() {
  if (currentTheme === "light" || currentTheme === "dark") return currentTheme;
  return _media && !_media.matches ? "light" : "dark";
}

export function applyAccentColor(hex) {
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

export async function loadAccentColor() {
  const { value } = await Preferences.get({ key: COLOR_KEY });
  applyAccentColor(value || DEFAULT_ACCENT);
  return currentAccent;
}

export async function setAccentColor(hex) {
  await Preferences.set({ key: COLOR_KEY, value: hex });
  applyAccentColor(hex);
}

export function getAccentColor() {
  return currentAccent;
}

export function applyTheme(theme) {
  currentTheme = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  document.documentElement.dataset.theme = currentTheme;
  applyAccentColor(currentAccent);
}

export async function loadTheme() {
  const { value } = await Preferences.get({ key: THEME_KEY });
  applyTheme(value || DEFAULT_THEME);
  return currentTheme;
}

export async function setTheme(theme) {
  await Preferences.set({ key: THEME_KEY, value: theme });
  applyTheme(theme);
}

export function getTheme() {
  return currentTheme;
}

if (_media) {
  _media.addEventListener("change", () => applyAccentColor(currentAccent));
}
