import { Api, ApiError } from "../lib/api.js";
import { setToken } from "../lib/session.js";
import { showToast } from "../lib/toast.js";
import { setLoading, shake } from "../lib/dom.js";

export async function renderLogin(container, { navigate, refreshUser }) {
  container.innerHTML = `
    <div class="auth-screen">
      <div class="brand-mark">🆘</div>
      <h1 class="auth-title">PanicSwitch</h1>
      <p class="auth-subtitle">Sign in to keep your emergency contacts one tap away.</p>

      <form id="login-form" class="form" novalidate>
        <label class="field">
          <span>Email</span>
          <input type="email" name="email" autocomplete="email" required />
        </label>
        <label class="field">
          <span>Password</span>
          <input type="password" name="password" autocomplete="current-password" required />
        </label>
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-label">Log In</span>
          <span class="btn-spinner" hidden></span>
        </button>
      </form>

      <p class="auth-switch">Don't have an account? <a href="#/register">Create one</a></p>
    </div>
  `;

  const form = container.querySelector("#login-form");
  const button = form.querySelector("button");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));

    setLoading(button, true);
    try {
      const { access_token } = await Api.login(data);
      await setToken(access_token);
      await refreshUser();
      navigate("home");
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : "Something went wrong.", "error");
    } finally {
      setLoading(button, false);
    }
  });
}
