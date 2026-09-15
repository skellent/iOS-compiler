import { Api } from "../lib/api.js";
import { getCurrentCoordinates } from "../lib/geolocation.js";
import { showToast } from "../lib/toast.js";
import { escapeHtml, shake } from "../lib/dom.js";
import { Icon } from "../lib/icons.js";
import { t } from "../lib/i18n.js";
import { getLiveTrackingState, observeLiveTracking, startLiveTracking, stopLiveTracking } from "../lib/liveTracking.js";
import { getRecordingState, hasPendingVideo, observeRecording, recordAlertVideo, retryVideoUpload, stopAlertVideoRecording } from "../lib/videoRecording.js";
import { openTikTokPost } from "../lib/tiktokPost.js";
import { Browser } from "@capacitor/browser";

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
        <p class="home-video-hint">${t("video.sosHint")}</p>
      </div>
      <section id="tracking-panel" class="tracking-panel" hidden aria-live="polite">
        <div class="tracking-panel-copy">
          <span id="tracking-dot" class="tracking-dot"></span>
          <div>
            <strong>${t("home.trackingTitle")}</strong>
            <span id="tracking-detail">${t("home.trackingConnecting")}</span>
          </div>
        </div>
        <button id="stop-tracking-btn" class="tracking-stop" type="button">${t("home.trackingStop")}</button>
      </section>
      <section id="video-panel" class="video-panel" hidden aria-live="polite">
        <strong>${t("video.alertRecording")}</strong>
        <p id="video-detail"></p>
        <p id="video-post-status"></p>
        <p id="video-drive-status"></p>
        <div class="video-actions">
          <button id="video-drive-link" class="btn btn-outline" type="button" hidden>${t("video.watchDrive")}</button>
          <button id="video-drive-upload" class="btn btn-outline" type="button" hidden>${t("video.sendDrive")}</button>
          <button id="video-retry" class="btn btn-outline" type="button" hidden>${t("video.retry")}</button>
          <button id="video-stop" class="btn btn-outline" type="button" hidden>${t("video.stopRecording")}</button>
          <button id="video-tiktok" class="btn btn-primary" type="button" hidden>${t("video.publish")}</button>
        </div>
      </section>
    </div>
  `;

  const btn = container.querySelector("#panic-btn");
  const ring = container.querySelector("#panic-ring-progress");
  const icon = container.querySelector("#panic-icon");
  const check = container.querySelector("#panic-check");
  const status = container.querySelector("#panic-status");
  const statusChip = container.querySelector("#home-status-chip");
  const trackingPanel = container.querySelector("#tracking-panel");
  const trackingDot = container.querySelector("#tracking-dot");
  const trackingDetail = container.querySelector("#tracking-detail");
  const stopTrackingBtn = container.querySelector("#stop-tracking-btn");
  const videoPanel = container.querySelector("#video-panel");
  const videoDetail = container.querySelector("#video-detail");
  const videoPostStatus = container.querySelector("#video-post-status");
  const videoDriveStatus = container.querySelector("#video-drive-status");
  const videoLink = container.querySelector("#video-drive-link");
  const videoDriveUpload = container.querySelector("#video-drive-upload");
  const videoRetry = container.querySelector("#video-retry");
  const videoStop = container.querySelector("#video-stop");
  const videoTikTok = container.querySelector("#video-tiktok");
  let lastAlertId = null;
  let tiktokConnected = false;
  let googleConnected = false;
  let tiktokStatus = null;
  let tiktokFailReason = null;
  let driveStatus = "not_uploaded";
  let driveUrl = null;
  let recording = getRecordingState();

  function renderVideo() {
    videoPanel.hidden = !lastAlertId;
    container.querySelector(".home-screen").classList.toggle("home-has-video", Boolean(lastAlertId));
    if (!lastAlertId) return;
    videoDetail.textContent = recording.alertId === lastAlertId ? recording.message : t("video.waiting");
    const ready = recording.alertId === lastAlertId && recording.status === "ready";
    videoPostStatus.textContent = tiktokStatus ? t(
      tiktokStatus === "PUBLISH_COMPLETE" ? "video.postComplete" :
      tiktokStatus === "FAILED" ? "video.postFailed" : "video.postProcessing"
    ) + (tiktokStatus === "FAILED" && tiktokFailReason ?
      ` ${t("video.postFailReason", { reason: tiktokFailReason.replaceAll("_", " ") })}` : "")
      : ready && !tiktokConnected ? t("video.connectTikTokFirst") : "";
    videoDriveStatus.textContent = driveStatus === "uploading" ? t("video.driveUploading") :
      driveStatus === "failed" ? t("video.driveFailed") : "";
    videoLink.hidden = !driveUrl;
    videoDriveUpload.hidden = !ready || !googleConnected || driveStatus === "uploading" || driveStatus === "ready";
    videoRetry.hidden = !(recording.alertId === lastAlertId && recording.retryable);
    videoStop.hidden = !(recording.alertId === lastAlertId && recording.status === "recording");
    videoTikTok.hidden = !ready || !tiktokConnected || Boolean(tiktokStatus && tiktokStatus !== "FAILED");
  }
  observeRecording((next) => { recording = next; renderVideo(); });
  videoRetry.addEventListener("click", () => retryVideoUpload(lastAlertId));
  videoStop.addEventListener("click", stopAlertVideoRecording);
  videoLink.addEventListener("click", () => { if (driveUrl) Browser.open({ url: driveUrl }); });
  videoDriveUpload.addEventListener("click", async () => {
    videoDriveUpload.disabled = true;
    try { await Api.sendVideoToDrive(lastAlertId); driveStatus = "uploading"; renderVideo(); }
    catch (error) { showToast(error instanceof Error ? error.message : t("errors.generic"), "error"); }
    finally { videoDriveUpload.disabled = false; }
  });
  videoTikTok.addEventListener("click", () => openTikTokPost(lastAlertId, () => {
    tiktokStatus = "PROCESSING_DOWNLOAD";
    tiktokFailReason = null;
    renderVideo();
  }));
  Api.getIntegrations().then((accounts) => {
    tiktokConnected = accounts.tiktok.connected;
    googleConnected = accounts.google.connected;
    renderVideo();
  }).catch(() => {});
  Api.listAlerts().then(async (alerts) => {
    if (!alerts.length || lastAlertId) return;
    lastAlertId = alerts[0].id;
    const result = await Api.getVideo(lastAlertId);
    tiktokStatus = result.tiktok_status;
    tiktokFailReason = result.tiktok_fail_reason;
    driveStatus = result.drive_status;
    driveUrl = result.url;
    if (result.status === "ready" && recording.alertId !== lastAlertId) {
      recording = { alertId: lastAlertId, status: "ready", retryable: false, message: t("video.ready") };
    } else if (await hasPendingVideo(lastAlertId) && recording.alertId !== lastAlertId) {
      recording = { alertId: lastAlertId, status: "failed", retryable: true, message: t("video.uploadFailed") };
    }
    renderVideo();
  }).catch(() => {});
  const videoClock = setInterval(async () => {
    if (!container.isConnected) { clearInterval(videoClock); return; }
    if (!lastAlertId || (driveStatus !== "uploading" && !tiktokStatus?.startsWith("PROCESSING"))) return;
    try {
      const result = await Api.getVideo(lastAlertId);
      driveStatus = result.drive_status;
      driveUrl = result.url;
      if (tiktokStatus?.startsWith("PROCESSING")) {
        const post = await Api.getTikTokStatus(lastAlertId);
        tiktokStatus = post.status;
        tiktokFailReason = post.fail_reason;
      }
      renderVideo();
    } catch { /* Status polling never interrupts an SOS. */ }
  }, 10000);

  // null = not yet known / lookup failed. Only a hard 0 blocks the alert; if we
  // can't determine it, we let the panic through — never block a panic on a failed
  // background check.
  let notifiableCount = null;
  loadStatusChip(statusChip, (count) => { notifiableCount = count; });

  let holding = false;
  let busy = false;
  let holdStart = 0;
  let rafId = null;

  function renderTrackingState(tracking) {
    trackingPanel.hidden = !tracking.active;
    btn.disabled = tracking.active;
    trackingDot.classList.toggle("tracking-dot-connected", tracking.connected);
    stopTrackingBtn.disabled = tracking.stopping;
    stopTrackingBtn.textContent = tracking.stopping ? t("home.trackingStopping") : t("home.trackingStop");
    if (!tracking.active) {
      if (!busy) status.textContent = tracking.error || t("home.idle");
      return;
    }
    busy = true;
    const started = tracking.startedAt ? new Date(tracking.startedAt) : null;
    const minutes = started && !Number.isNaN(started.getTime()) ? Math.max(0, Math.floor((Date.now() - started.getTime()) / 60000)) : 0;
    trackingDetail.textContent = tracking.error
      ? tracking.error
      : t(tracking.connected ? "home.trackingConnected" : "home.trackingConnecting", { minutes });
    status.textContent = t("home.trackingActive");
  }

  observeLiveTracking(renderTrackingState);
  const trackingClock = setInterval(() => {
    if (!container.isConnected) {
      clearInterval(trackingClock);
      return;
    }
    renderTrackingState(getLiveTrackingState());
  }, 30000);

  function setRingProgress(progress) {
    ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
    btn.style.setProperty("--hold", String(progress));
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
    // If we positively know there's nobody to notify, don't fire into the void —
    // tell the user to confirm a contact first. Unknown count (null) still proceeds.
    if (notifiableCount === 0) {
      btn.classList.remove("panic-btn-holding");
      setRingProgress(0);
      status.textContent = t("home.idle");
      showToast(t("home.noContacts"), "error");
      shake(btn);
      return;
    }

    busy = true;
    btn.classList.remove("panic-btn-holding");
    btn.classList.add("panic-btn-busy");
    status.textContent = t("home.locating");

    try {
      const coordinates = await getCurrentCoordinates();
      status.textContent = t("home.sending");
      const alert = await Api.createAlert(coordinates);
      lastAlertId = alert.id;
      tiktokStatus = null;
      tiktokFailReason = null;
      driveStatus = "not_uploaded";
      driveUrl = null;
      renderVideo();
      let trackingStarted = true;
      try {
        await startLiveTracking(alert);
      } catch {
        trackingStarted = false;
        await stopLiveTracking(Api.stopAlert).catch(() => {});
      }
      recordAlertVideo(alert.id);

      btn.classList.remove("panic-btn-busy");
      btn.classList.add("panic-btn-success");
      icon.hidden = true;
      check.hidden = false;
      status.textContent = t(trackingStarted ? "home.sent" : "home.trackingUnavailable");
      showToast(t(trackingStarted ? "home.sentToast" : "home.trackingUnavailable"), trackingStarted ? "success" : "error");
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
    if (getLiveTrackingState().active) {
      btn.classList.remove("panic-btn-busy", "panic-btn-success", "panic-btn-error");
      icon.hidden = false;
      check.hidden = true;
      renderTrackingState(getLiveTrackingState());
      return;
    }
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
  stopTrackingBtn.addEventListener("click", async () => {
    try {
      await stopLiveTracking(Api.stopAlert);
      busy = false;
      btn.disabled = false;
      resetButton();
      showToast(t("home.trackingStopped"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("home.trackingStopError"), "error");
    }
  });
}

async function loadStatusChip(chip, onCount) {
  try {
    const contacts = await Api.listContacts();
    // A contact is reachable by email (confirmed) OR by Telegram — matches the
    // backend's own "who gets notified" rule, so the count doesn't understate it.
    const notifiable = contacts.filter((contact) =>
      contact.confirmed || contact.telegram_linked || contact.whatsapp_confirmed || contact.sms_enabled
    ).length;
    onCount(notifiable);
    chip.innerHTML =
      notifiable > 0
        ? `${Icon.contacts()} ${t(notifiable === 1 ? "home.statusReady" : "home.statusReadyPlural", { count: notifiable })}`
        : `${Icon.contacts()} ${t("home.statusNone")}`;
    chip.classList.add("home-status-visible");
  } catch {
    // Leave the count unknown so the panic button still works if this lookup failed.
  }
}
// TypeScript source.
