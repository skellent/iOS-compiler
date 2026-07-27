import { Api } from "../lib/api.js";
import { getCurrentCoordinates } from "../lib/geolocation.js";
import { showToast } from "../lib/toast.js";
import { escapeHtml, shake } from "../lib/dom.js";
import { Icon } from "../lib/icons.js";
import { t } from "../lib/i18n.js";

const HOLD_DURATION_MS = 1400;
const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RESET_DELAY_MS = 2600;

export async function renderHome(container, { getUser }) {
  const user = getUser();
  const firstName = (user?.name ?? "there").split(" ")[0];

  container.innerHTML = `
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

  const btn = container.querySelector("#panic-btn");
  const ring = container.querySelector("#panic-ring-progress");
  const icon = container.querySelector("#panic-icon");
  const check = container.querySelector("#panic-check");
  const status = container.querySelector("#panic-status");
  const statusChip = container.querySelector("#home-status-chip");

  loadStatusChip(statusChip);

  let holding = false;
  let busy = false;
  let holdStart = 0;
  let rafId = null;

  function setRingProgress(progress) {
    ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
  }

  function tick() {
    const progress = Math.min((performance.now() - holdStart) / HOLD_DURATION_MS, 1);
    setRingProgress(progress);
    if (progress >= 1) {
      holding = false;
      sendAlert();
      return;
    }
    if (holding) rafId = requestAnimationFrame(tick);
  }

  function startHold() {
    if (busy || holding) return;
    holding = true;
    holdStart = performance.now();
    btn.classList.add("panic-btn-holding");
    status.textContent = t("home.holding");
    rafId = requestAnimationFrame(tick);
  }

  function cancelHold() {
    if (!holding) return;
    holding = false;
    cancelAnimationFrame(rafId);
    btn.classList.remove("panic-btn-holding");
    setRingProgress(0);
    status.textContent = t("home.idle");
  }

  async function sendAlert() {
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
      icon.hidden = true;
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
    icon.hidden = false;
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

async function loadStatusChip(chip) {
  try {
    const contacts = await Api.listContacts();
    const confirmedCount = contacts.filter((contact) => contact.confirmed).length;
    chip.innerHTML =
      confirmedCount > 0
        ? `${Icon.contacts()} ${t(confirmedCount === 1 ? "home.statusReady" : "home.statusReadyPlural", { count: confirmedCount })}`
        : `${Icon.contacts()} ${t("home.statusNone")}`;
    chip.classList.add("home-status-visible");
  } catch {
    // Silently skip the chip if contacts can't be loaded — the panic button still works.
  }
}
