import { Api } from "./api.js";
import { t } from "./i18n.js";

export type RecordingState = {
  alertId: number | null;
  status: "idle" | "recording" | "uploading" | "ready" | "failed";
  message: string;
  retryable: boolean;
  driveUrl?: string | null;
};

type PendingVideo = { alertId: number; blob: Blob; durationSeconds: number };
const DB_NAME = "panicbutton-recordings";
let state: RecordingState = { alertId: null, status: "idle", message: "", retryable: false };
let activeRecorder: MediaRecorder | null = null;
let stopRequested = false;
let wakeLock: WakeLockSentinel | null = null;
const listeners = new Set<(state: RecordingState) => void>();
const memory = new Map<number, PendingVideo>();

function update(patch: Partial<RecordingState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener({ ...state });
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DB_NAME, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("pending", { keyPath: "alertId" });
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
}

async function pendingVideo(alertId: number): Promise<PendingVideo | null> {
  if (memory.has(alertId)) return memory.get(alertId)!;
  try {
    const db = await database();
    return await new Promise((resolve) => {
      const request = db.transaction("pending").objectStore("pending").get(alertId);
      request.onsuccess = () => { db.close(); resolve(request.result || null); };
      request.onerror = () => { db.close(); resolve(null); };
    });
  } catch { return null; }
}

async function persistPending(video: PendingVideo) {
  memory.set(video.alertId, video);
  try {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("pending", "readwrite");
      transaction.objectStore("pending").put(video);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    });
  } catch { /* The in-memory copy still permits retry in this session. */ }
}

async function clearPending(alertId: number) {
  memory.delete(alertId);
  try {
    const db = await database();
    await new Promise<void>((resolve) => {
      const transaction = db.transaction("pending", "readwrite");
      transaction.objectStore("pending").delete(alertId);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); resolve(); };
    });
  } catch { /* Already uploaded; stale cache can be cleared on a later retry. */ }
}

export function getRecordingState() { return { ...state }; }
export function observeRecording(listener: (state: RecordingState) => void) {
  listeners.add(listener);
  listener(getRecordingState());
  return () => listeners.delete(listener);
}

export async function hasPendingVideo(alertId: number) { return Boolean(await pendingVideo(alertId)); }
export async function confirmVideoUploaded(alertId: number, driveUrl: string | null) {
  await clearPending(alertId);
  update({ alertId, status: "ready", message: t("video.ready"), retryable: false, driveUrl });
}
export function stopAlertVideoRecording() {
  stopRequested = true;
  if (activeRecorder?.state === "recording") activeRecorder.stop();
}

export async function retryVideoUpload(alertId: number) {
  const pending = await pendingVideo(alertId);
  if (!pending) return;
  update({ alertId, status: "uploading", message: t("video.uploading"), retryable: false });
  try {
    const result = await Api.uploadVideo(alertId, pending.blob, pending.durationSeconds);
    await confirmVideoUploaded(alertId, result.url);
  } catch (error) {
    if ((error as { status?: number }).status === 409) {
      const existing = await Api.getVideo(alertId).catch(() => null);
      if (existing?.status === "ready") {
        await confirmVideoUploaded(alertId, existing.url);
        return;
      }
      if (existing?.status === "uploading") {
        update({ status: "uploading", message: t("video.uploading"), retryable: false });
        return;
      }
      update({ status: "failed", message: t("video.connectDriveFirst"), retryable: true });
      return;
    }
    update({ status: "failed", message: t("video.uploadFailed"), retryable: true });
  }
}

export async function recordAlertVideo(alertId: number) {
  if (activeRecorder?.state === "recording") return;
  stopRequested = false;
  const configured = await Api.getFeatures().then((features) => features.video_record_seconds).catch(() => 300);
  const seconds = Math.max(1, configured);
  update({ alertId, status: "recording", message: t("video.recording", { seconds }), retryable: false });
  let stream: MediaStream | null = null;
  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error(t("video.unsupported"));
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
    } catch (error) {
      if (error instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(error.name)) {
        throw new Error(t("video.permissionsRequired"));
      }
      throw error;
    }
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error(t("video.audioUnavailable"));
    }
    if (stopRequested) {
      stream.getTracks().forEach((track) => track.stop());
      update({ status: "failed", message: t("video.stoppedBeforeCapture"), retryable: false });
      return;
    }
    const mimeType = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
      .find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error(t("video.unsupported"));
    const chunks: Blob[] = [];
    const bitrate = Math.min(2_000_000, Math.floor((85 * 1024 * 1024 * 8) / seconds));
    activeRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
    const recorder = activeRecorder;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const stop = () => { if (recorder.state === "recording") recorder.stop(); };
    const onVisibility = () => { if (document.visibilityState === "hidden") stop(); };
    const captured = new Promise<Blob>((resolve, reject) => {
      recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
      recorder.addEventListener("error", () => { stop(); reject(new Error(t("video.captureFailed"))); }, { once: true });
      recorder.addEventListener("stop", () => {
        clearTimeout(timer);
        document.removeEventListener("visibilitychange", onVisibility);
        stream?.getTracks().forEach((track) => track.stop());
        wakeLock?.release().catch(() => {});
        wakeLock = null;
        activeRecorder = null;
        resolve(new Blob(chunks, { type: mimeType.split(";", 1)[0] }));
      }, { once: true });
    });
    document.addEventListener("visibilitychange", onVisibility);
    recorder.start(1000);
    if (stopRequested) stop();
    if (navigator.wakeLock) {
      navigator.wakeLock.request("screen").then((lock) => {
        if (recorder.state === "inactive") lock.release().catch(() => {});
        else wakeLock = lock;
      }).catch(() => {});
    }
    timer = setTimeout(stop, seconds * 1000);
    const blob = await captured;
    if (!blob.size) throw new Error(t("video.captureFailed"));
    if (blob.size > 100 * 1024 * 1024) throw new Error(t("video.tooLarge"));
    await persistPending({ alertId, blob, durationSeconds: Math.max(1, Math.ceil((Date.now() - startedAt) / 1000)) });
    await retryVideoUpload(alertId);
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    update({ status: "failed", message: error instanceof Error ? error.message : t("video.captureFailed"), retryable: false });
  }
}
