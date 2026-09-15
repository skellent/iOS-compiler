(() => {
  const config = JSON.parse(document.getElementById("live-config").textContent);
  const statusEl = document.getElementById("connection-status");
  const statusLabel = document.getElementById("status-label");
  const lastUpdateEl = document.getElementById("last-update");
  const recenterButton = document.getElementById("recenter-button");
  const videoStatus = document.getElementById("video-status");
  const videoLink = document.getElementById("video-link");

  async function refreshVideo() {
    try {
      const response = await fetch(config.videoPath, { cache: "no-store" });
      if (!response.ok) return;
      const video = await response.json();
      videoLink.hidden = video.status !== "ready" || !video.url;
      if (!videoLink.hidden) videoLink.href = video.url;
      videoStatus.textContent = {
        ready: "The recording is ready to watch.",
        uploading: "Recording is uploading to Google Drive…",
        failed: "The recording could not be uploaded.",
        not_uploaded: "A recording is saved. A Google Drive link is not available yet.",
        not_recorded: "Waiting for a recording…",
      }[video.status] || "Waiting for a recording…";
    } catch { /* A failed poll should not interrupt the live map. */ }
  }

  const map = L.map("map", { zoomControl: true }).setView([0, 0], 2);
  L.tileLayer(config.tileUrl, {
    attribution: config.tileAttribution,
    maxZoom: 19,
  }).addTo(map);

  const markerIcon = L.divIcon({ className: "", html: '<div class="panic-marker"></div>', iconSize: [24, 24], iconAnchor: [12, 12] });
  const trail = L.polyline([], { color: "#ea2052", weight: 4, opacity: 0.82 }).addTo(map);
  let marker = null;
  let accuracyCircle = null;
  let socket = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let latestSequence = -1;
  let lastLocationAt = null;
  let following = true;
  let terminal = false;
  let reconnectAttempt = 0;

  function setStatus(kind, label) {
    statusEl.className = `status status-${kind}`;
    statusLabel.textContent = label;
  }

  function parseDate(value) {
    if (!value) return null;
    const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function updateAge() {
    if (!lastLocationAt) return;
    const seconds = Math.max(0, Math.round((Date.now() - lastLocationAt.getTime()) / 1000));
    lastUpdateEl.textContent = seconds < 5 ? "Location updated just now" : `Location updated ${seconds} seconds ago`;
    if (!terminal && seconds > 45) setStatus("stale", "Signal delayed");
  }

  function renderLocation(point, appendTrail = true) {
    if (!point || point.latitude == null || point.longitude == null) return;
    if (point.sequence != null && point.sequence < latestSequence) return;
    latestSequence = Math.max(latestSequence, point.sequence ?? latestSequence);
    const latLng = [point.latitude, point.longitude];

    if (!marker) marker = L.marker(latLng, { icon: markerIcon }).addTo(map);
    else marker.setLatLng(latLng);

    if (!accuracyCircle) {
      accuracyCircle = L.circle(latLng, { radius: point.accuracy || 0, color: "#ea2052", weight: 1, fillOpacity: .12 }).addTo(map);
    } else {
      accuracyCircle.setLatLng(latLng).setRadius(point.accuracy || 0);
    }

    if (appendTrail) trail.addLatLng(latLng);
    lastLocationAt = parseDate(point.recorded_at) || new Date();
    updateAge();
    if (following) map.setView(latLng, Math.max(map.getZoom(), 16), { animate: Boolean(marker) });
  }

  function applyStatus(status) {
    if (status === "active") {
      terminal = false;
      setStatus("live", "Live");
      return;
    }
    terminal = true;
    setStatus("ended", status === "expired" ? "Tracking expired" : "Tracking ended");
  }

  function handleMessage(message) {
    if (message.type === "snapshot") {
      trail.setLatLngs([]);
      for (const point of message.points || []) renderLocation(point, true);
      if (!(message.points || []).length) renderLocation(message.latest, true);
      lastLocationAt = parseDate(message.last_location_at) || lastLocationAt;
      applyStatus(message.status);
    } else if (message.type === "location") {
      renderLocation(message, true);
      setStatus("live", "Live");
    } else if (message.type === "status") {
      applyStatus(message.status);
    } else if (message.type === "pong" && message.status) {
      applyStatus(message.status);
    }
  }

  function connect() {
    clearTimeout(reconnectTimer);
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${location.host}${config.livePath}`);
    setStatus("connecting", reconnectAttempt ? "Reconnecting…" : "Connecting…");

    socket.addEventListener("open", () => {
      reconnectAttempt = 0;
      clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
      }, 25000);
    });
    socket.addEventListener("message", (event) => {
      try { handleMessage(JSON.parse(event.data)); } catch { setStatus("error", "Invalid live update"); }
    });
    socket.addEventListener("close", (event) => {
      clearInterval(heartbeatTimer);
      if (terminal || event.code === 4401 || event.code === 4404) {
        if (!terminal) setStatus("error", event.code === 4401 ? "Link expired" : "Alert unavailable");
        return;
      }
      reconnectAttempt += 1;
      const delay = Math.min(30000, 1000 * (2 ** Math.min(reconnectAttempt, 5)));
      reconnectTimer = setTimeout(connect, delay);
      setStatus("connecting", "Reconnecting…");
    });
  }

  map.on("dragstart", () => {
    following = false;
    recenterButton.hidden = false;
  });
  recenterButton.addEventListener("click", () => {
    following = true;
    recenterButton.hidden = true;
    if (marker) map.setView(marker.getLatLng(), Math.max(map.getZoom(), 16), { animate: true });
  });

  setInterval(updateAge, 1000);
  refreshVideo();
  setInterval(refreshVideo, 10000);
  connect();
})();
