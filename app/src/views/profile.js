import { Api, ApiError } from "../lib/api.js";
import { showToast } from "../lib/toast.js";
import { escapeHtml, setLoading, shake } from "../lib/dom.js";

export async function renderProfile(container, { getUser, refreshUser, logout }) {
  const user = getUser();

  container.innerHTML = `
    <div class="profile-screen">
      <div class="profile-avatar">${escapeHtml((user?.name ?? "?").charAt(0).toUpperCase())}</div>

      <form id="profile-form" class="form" novalidate>
        <label class="field">
          <span>Name</span>
          <input type="text" name="name" required value="${escapeHtml(user?.name ?? "")}" />
        </label>
        <label class="field">
          <span>Phone</span>
          <input type="tel" name="phone" required value="${escapeHtml(user?.phone ?? "")}" />
        </label>
        <label class="field">
          <span>Email</span>
          <input type="email" name="email" required value="${escapeHtml(user?.email ?? "")}" />
        </label>
        <label class="field">
          <span>New password (optional)</span>
          <input type="password" name="password" autocomplete="new-password" placeholder="Leave blank to keep current password" />
        </label>
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-label">Save Changes</span>
          <span class="btn-spinner" hidden></span>
        </button>
      </form>

      <button id="logout-btn" class="btn btn-outline btn-block" type="button">Log Out</button>
    </div>
  `;

  const form = container.querySelector("#profile-form");
  const button = form.querySelector("button[type=submit]");
  const logoutBtn = container.querySelector("#logout-btn");

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
      showToast("No changes to save.", "info");
      return;
    }

    setLoading(button, true);
    try {
      await Api.updateMe(changes);
      await refreshUser();
      form.querySelector("input[name=password]").value = "";
      showToast("Profile updated.", "success");
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : "Something went wrong.", "error");
    } finally {
      setLoading(button, false);
    }
  });

  logoutBtn.addEventListener("click", () => logout());
}
