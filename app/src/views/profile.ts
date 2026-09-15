import { Api, ApiError } from "../lib/api.js";
import { showToast } from "../lib/toast.js";
import { escapeHtml, setLoading, shake } from "../lib/dom.js";
import { Icon } from "../lib/icons.js";
import { t, LANGUAGES } from "../lib/i18n.js";
import { DEFAULT_ACCENT } from "../lib/theme.js";
import { connectIntegration } from "../lib/integrationBrowser.js";

const COLOR_PRESETS = [DEFAULT_ACCENT, "#2563eb", "#16a34a", "#9333ea", "#f97316", "#0d9488"];

export async function renderProfile(container, { getUser, refreshUser, logout, navigate, getLanguage, changeLanguage, getAccentColor, setAccentColor, getTheme, setTheme }) {
  const user = getUser();
  const lang = getLanguage();
  const accentColor = getAccentColor();
  const isPreset = COLOR_PRESETS.includes(accentColor);
  const theme = getTheme();

  container.innerHTML = `
    <div class="profile-screen">

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
      <div class="form">
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
      </div>
      <section class="form integrations" aria-label="Video accounts">
        <h2>${t("video.accounts")}</h2>
        <p>${t("video.accountsHint")}</p>
        <div id="integration-tiktok"></div>
        <div id="integration-google"></div>
        <button id="refresh-integrations" class="btn btn-outline btn-block" type="button">${t("video.refreshAccounts")}</button>
      </section>
      <div class="form configs">
      <button id="help-btn" class="btn btn-outline btn-block" type="button">
        ${Icon.help()}
        <span class="btn-label">${t("profile.help")}</span>
      </button>

      <button id="about-btn" class="btn btn-outline btn-block" type="button">
        ${Icon.info()}
        <span class="btn-label">${t("profile.about")}</span>
      </button>
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

  async function refreshIntegrations() {
    try {
      const statuses = await Api.getIntegrations();
      for (const provider of ["tiktok", "google"] as const) {
        const target = container.querySelector(`#integration-${provider}`);
        const name = provider === "google" ? "Google Drive" : "TikTok";
        const status = statuses[provider];
        target.innerHTML = `<div class="integration-row"><span>${name}<small>${escapeHtml(status.connected ? t("video.connected") : status.available ? t("video.disconnected") : t("video.unavailable"))}</small></span><button class="btn btn-outline" type="button" ${status.available ? "" : "disabled"}>${t(status.connected ? "video.disconnect" : "video.connect")}</button></div>`;
        target.querySelector("button").addEventListener("click", async (event) => {
          event.currentTarget.disabled = true;
          try {
            if (status.connected) { await Api.disconnectIntegration(provider); await refreshIntegrations(); }
            else await connectIntegration(provider);
          } catch (error) { showToast(error instanceof Error ? error.message : t("errors.generic"), "error"); }
          finally { event.currentTarget.disabled = false; }
        });
      }
    } catch (error) { showToast(error instanceof Error ? error.message : t("errors.generic"), "error"); }
  }
  container.querySelector("#refresh-integrations").addEventListener("click", refreshIntegrations);
  refreshIntegrations();

  container.querySelector("#lang-select").addEventListener("change", (event) => changeLanguage(event.target.value));
  container.querySelector("#theme-select").addEventListener("change", (event) => setTheme(event.target.value));

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
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (!data.password) delete data.password;

    const changes: Record<string, string> = {};
    for (const key of ["name", "phone", "email", "password"]) {
      if (data[key] !== undefined && data[key] !== (user?.[key] ?? "")) {
        changes[key] = data[key];
      }
    }

    if (Object.keys(changes).length === 0) {
      showToast(t("profile.noChanges"), "info");
      return;
    }

    // Changing email or password requires re-entering the current password, which
    // the backend verifies. Ask up front rather than round-tripping to a 400.
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
  container.querySelector("#help-btn").addEventListener("click", () => navigate("help"));
  container.querySelector("#about-btn").addEventListener("click", () => navigate("about"));
}
// TypeScript source.
