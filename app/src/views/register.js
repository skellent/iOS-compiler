import { Api, ApiError } from "../lib/api.js";
import { setToken } from "../lib/session.js";
import { showToast } from "../lib/toast.js";
import { setLoading, shake } from "../lib/dom.js";

export async function renderRegister(container, { navigate, refreshUser }) {
  container.innerHTML = `
    <div class="auth-screen">
      <div class="brand-mark">🆘</div>
      <h1 class="auth-title">Create Account</h1>
      <p class="auth-subtitle">A few details, and you're ready to add your emergency contacts.</p>

      <form id="register-form" class="form" novalidate>
        <label class="field">
          <span>Full name</span>
          <input type="text" name="name" autocomplete="name" required />
        </label>
        <label class="field">
          <span>Phone</span>
          <input type="tel" name="phone" autocomplete="tel" required />
        </label>
        <label class="field">
          <span>Email</span>
          <input type="email" name="email" autocomplete="email" required />
        </label>
        <label class="field">
          <span>Password</span>
          <input type="password" name="password" autocomplete="new-password" minlength="8" required />
        </label>
        <label class="field">
          <span>Confirm password</span>
          <input type="password" name="confirm_password" autocomplete="new-password" required />
        </label>
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-label">Create Account</span>
          <span class="btn-spinner" hidden></span>
        </button>
      </form>

      <p class="auth-switch">Already have an account? <a href="#/login">Log in</a></p>
    </div>
  `;

  const form = container.querySelector("#register-form");
  const button = form.querySelector("button");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { confirm_password, ...data } = Object.fromEntries(new FormData(form));

    if (data.password !== confirm_password) {
      shake(form);
      showToast("Passwords don't match.", "error");
      return;
    }

    setLoading(button, true);
    try {
      await Api.register(data);
      const { access_token } = await Api.login({ email: data.email, password: data.password });
      await setToken(access_token);
      await refreshUser();
      showToast("Account created — welcome to PanicSwitch.", "success");
      navigate("home");
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : "Something went wrong.", "error");
    } finally {
      setLoading(button, false);
    }
  });
}
