import { Api } from "../lib/api.js";
import { getCurrentCoordinates } from "../lib/geolocation.js";
import { showToast } from "../lib/toast.js";
import { escapeHtml, shake } from "../lib/dom.js";

const HOLD_DURATION_MS = 1400;
const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RESET_DELAY_MS = 2600;

export async function renderHome(container, { getUser }) {
  const user = getUser();
  const firstName = (user?.name ?? "there").split(" ")[0];

  container.innerHTML = `
    <div class="home-screen">
      <p class="home-greeting">Hi, ${escapeHtml(firstName)}</p>

      <div class="panic-wrap">
        <button id="panic-btn" class="panic-btn" type="button" aria-label="Hold to send a panic alert">
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
        <p id="panic-status" class="panic-status" aria-live="polite">Press and hold to alert your contacts</p>
      </div>
    </div>
  `;

  const btn = container.querySelector("#panic-btn");
  const ring = container.querySelector("#panic-ring-progress");
  const icon = container.querySelector("#panic-icon");
  const check = container.querySelector("#panic-check");
  const status = container.querySelector("#panic-status");

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
    status.textContent = "Keep holding to confirm...";
    rafId = requestAnimationFrame(tick);
  }

  function cancelHold() {
    if (!holding) return;
    holding = false;
    cancelAnimationFrame(rafId);
    btn.classList.remove("panic-btn-holding");
    setRingProgress(0);
    status.textContent = "Press and hold to alert your contacts";
  }

  async function sendAlert() {
    busy = true;
    btn.classList.remove("panic-btn-holding");
    btn.classList.add("panic-btn-busy");
    status.textContent = "Getting your location...";

    try {
      const { latitude, longitude } = await getCurrentCoordinates();
      status.textContent = "Sending alert...";
      await Api.createAlert({ latitude, longitude });

      btn.classList.remove("panic-btn-busy");
      btn.classList.add("panic-btn-success");
      icon.hidden = true;
      check.hidden = false;
      status.textContent = "Alert sent — your contacts are being notified";
      showToast("Panic alert sent successfully.", "success");
    } catch (error) {
      btn.classList.remove("panic-btn-busy");
      btn.classList.add("panic-btn-error");
      const message = error instanceof Error ? error.message : "Couldn't send the alert.";
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
    status.textContent = "Press and hold to alert your contacts";
  }

  btn.addEventListener("pointerdown", startHold);
  btn.addEventListener("pointerup", cancelHold);
  btn.addEventListener("pointerleave", cancelHold);
  btn.addEventListener("pointercancel", cancelHold);
}
