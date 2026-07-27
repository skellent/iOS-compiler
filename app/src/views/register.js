import { Api, ApiError } from "../lib/api.js";
import { showToast } from "../lib/toast.js";
import { setLoading, shake, escapeHtml } from "../lib/dom.js";
import { Icon } from "../lib/icons.js";
import { t } from "../lib/i18n.js";

export async function renderRegister(container, { navigate }) {
  container.innerHTML = `
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
          <input type="tel" name="phone" autocomplete="tel" required />
        </label>
        <label class="field">
          <span>${t("register.email")}</span>
          <input type="email" name="email" autocomplete="email" required />
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

  const form = container.querySelector("#register-form");
  const button = form.querySelector("button");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { confirm_password, ...data } = Object.fromEntries(new FormData(form));

    if (data.password !== confirm_password) {
      shake(form);
      showToast(t("register.passwordMismatch"), "error");
      return;
    }

    setLoading(button, true);
    try {
      await Api.register(data);
      // Login is blocked until the account is confirmed, so there's nothing
      // to log into yet — show the confirmation screen instead of trying
      // (and failing) to start a session.
      renderConfirmEmail(container, data.email, navigate);
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : t("errors.generic"), "error");
      setLoading(button, false);
    }
  });
}

function renderConfirmEmail(container, email, navigate) {
  container.innerHTML = `
    <div class="confirm-mail-screen">
      <div class="confirm-mail-icon">${Icon.mail()}</div>
      <h1 class="auth-title">${t("confirmMail.title")}</h1>
      <p class="auth-subtitle">${t("confirmMail.subtitle", { email: escapeHtml(email) })}</p>
      <button id="back-to-login" class="btn btn-outline" type="button">${t("confirmMail.back")}</button>
    </div>
  `;

  container.querySelector("#back-to-login").addEventListener("click", () => navigate("login"));
}
