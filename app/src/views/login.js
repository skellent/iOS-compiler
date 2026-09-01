import { Api, ApiError } from "../lib/api.js";
import { setToken } from "../lib/session.js";
import { showToast } from "../lib/toast.js";
import { setLoading, shake } from "../lib/dom.js";
import { t } from "../lib/i18n.js";
import { Icon } from "../lib/icons.js";

export async function renderLogin(container, { navigate, refreshUser }) {
  container.innerHTML = `
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
          <div>
            <input type="password" name="password" autocomplete="current-password" required />
            <span id="show-password" class="show-password"></span>
          </div>
        </label>
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-label">${t("login.submit")}</span>
          <span class="btn-spinner" hidden></span>
        </button>
      </form>

      <p class="auth-switch"><a href="#" id="forgot-link">${t("login.forgot")}</a></p>
      <p class="auth-switch">${t("login.switch")} <a href="#/register">${t("login.switchLink")}</a></p>
    </div>
  `;

  const form = container.querySelector("#login-form");
  const button = form.querySelector('button[type="submit"]');

  const forgotLink = container.querySelector("#forgot-link");
  forgotLink.addEventListener("click", async (event) => {
    event.preventDefault();
    const email = form.querySelector('input[name="email"]').value.trim();
    if (!email) {
      showToast(t("login.forgotNeedEmail"), "info");
      return;
    }
    try {
      await Api.requestPasswordReset(email);
    } catch {
    }
    showToast(t("login.forgotSent"), "success");
  });

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

  const passwordShowSpans = form.querySelectorAll(".show-password");
  passwordShowSpans.forEach((span) => {
    span.innerHTML = Icon.eyeOff();
    span.addEventListener("click", () => togglePasswordVisibility(span));
  });
  function togglePasswordVisibility(span) {
    const input = span.previousElementSibling;
    if (input.type === "password") {
      input.type = "text";
      span.innerHTML = Icon.eye();
    } else {
      input.type = "password";
      span.innerHTML = Icon.eyeOff();
    }
  }
}