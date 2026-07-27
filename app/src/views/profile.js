import { Api, ApiError } from "../lib/api.js";
import { showToast } from "../lib/toast.js";
import { escapeHtml, setLoading, shake } from "../lib/dom.js";
import { Icon } from "../lib/icons.js";
import { t } from "../lib/i18n.js";
import { DEFAULT_ACCENT } from "../lib/theme.js";

const COLOR_PRESETS = [DEFAULT_ACCENT, "#2563eb", "#16a34a", "#9333ea", "#f97316", "#0d9488"];

export async function renderProfile(container, { getUser, refreshUser, logout, getLanguage, changeLanguage, getAccentColor, setAccentColor }) {
  const user = getUser();
  const lang = getLanguage();
  const accentColor = getAccentColor();
  const isPreset = COLOR_PRESETS.includes(accentColor);

  container.innerHTML = `
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
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-label">${t("profile.save")}</span>
          <span class="btn-spinner" hidden></span>
        </button>
      </form>

      <div class="lang-switcher">
        <span class="lang-switcher-label">${Icon.language()} ${t("profile.language")}</span>
        <div class="lang-switcher-options">
          <button type="button" class="lang-option ${lang === "en" ? "lang-option-active" : ""}" data-lang="en">EN</button>
          <button type="button" class="lang-option ${lang === "es" ? "lang-option-active" : ""}" data-lang="es">ES</button>
        </div>
      </div>

      <div class="color-switcher">
        <span class="lang-switcher-label">${Icon.palette()} ${t("profile.color")}</span>
        <div class="color-swatches">
          ${COLOR_PRESETS.map(
            (hex) => `
            <button type="button" class="color-swatch ${!isPreset ? "" : hex === accentColor ? "color-swatch-active" : ""}"
                    data-color="${hex}" style="background:${hex}" aria-label="${hex}"></button>
          `
          ).join("")}
          <label class="color-swatch color-swatch-custom ${!isPreset ? "color-swatch-active" : ""}"
                 style="background:${!isPreset ? accentColor : "conic-gradient(from 0deg, red, orange, yellow, green, blue, violet, red)"}"
                 title="${t("profile.colorCustom")}">
            <input type="color" id="color-custom-input" value="${accentColor}" />
          </label>
        </div>
      </div>

      <button id="logout-btn" class="btn btn-outline btn-block" type="button">
        ${Icon.logout()}
        <span class="btn-label">${t("profile.logout")}</span>
      </button>
    </div>
  `;

  const form = container.querySelector("#profile-form");
  const button = form.querySelector("button[type=submit]");
  const logoutBtn = container.querySelector("#logout-btn");

  container.querySelectorAll(".lang-option").forEach((option) => {
    option.addEventListener("click", () => changeLanguage(option.dataset.lang));
  });

  const customSwatch = container.querySelector(".color-swatch-custom");
  const customInput = container.querySelector("#color-custom-input");

  function markActiveSwatch(hex) {
    container.querySelectorAll(".color-swatch[data-color]").forEach((swatch) => {
      swatch.classList.toggle("color-swatch-active", swatch.dataset.color === hex);
    });
    const isCustom = !COLOR_PRESETS.includes(hex);
    customSwatch.classList.toggle("color-swatch-active", isCustom);
    if (isCustom) customSwatch.style.background = hex;
  }

  container.querySelectorAll(".color-swatch[data-color]").forEach((swatch) => {
    swatch.addEventListener("click", () => {
      setAccentColor(swatch.dataset.color);
      markActiveSwatch(swatch.dataset.color);
    });
  });

  customInput.addEventListener("input", () => {
    setAccentColor(customInput.value);
    markActiveSwatch(customInput.value);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.password) delete data.password;

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

    setLoading(button, true);
    try {
      await Api.updateMe(changes);
      await refreshUser();
      form.querySelector("input[name=password]").value = "";
      showToast(t("profile.updated"), "success");
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : t("errors.generic"), "error");
    } finally {
      setLoading(button, false);
    }
  });

  logoutBtn.addEventListener("click", () => logout());
}
