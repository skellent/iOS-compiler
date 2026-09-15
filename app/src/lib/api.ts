import { getToken } from "./session.js";
import { t } from "./i18n.js";

const BASE_URL = import.meta.env.API_BASE_URL;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function extractMessage(body: any): string {
  if (!body) return t("errors.generic");
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  return t("errors.generic");
}

async function request(path: string, { method = "GET", body, auth = false }: { method?: string; body?: unknown; auth?: boolean } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(t("errors.network"), 0);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(extractMessage(data), response.status);
  }
  return data;
}

async function uploadVideo(alertId: number, video: Blob, durationSeconds: number) {
  const token = await getToken();
  const body = new FormData();
  body.append("video", video, `alert-${alertId}.${video.type === "video/mp4" ? "mp4" : "webm"}`);
  body.append("duration_seconds", String(durationSeconds));
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/alerts/${alertId}/video`, {
      method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body,
    });
  } catch { throw new ApiError(t("errors.network"), 0); }
  const data = await response.json();
  if (!response.ok) throw new ApiError(extractMessage(data), response.status);
  return data;
}

export const Api = {
  register: (data) => request("/auth/register", { method: "POST", body: data }),
  login: (data) => request("/auth/login", { method: "POST", body: data }),
  requestPasswordReset: (email) => request("/auth/password-reset/request", { method: "POST", body: { email } }),

  getMe: () => request("/users/me", { auth: true }),
  updateMe: (data) => request("/users/me", { method: "PUT", body: data, auth: true }),

  listContacts: () => request("/contacts", { auth: true }),
  createContact: (data) => request("/contacts", { method: "POST", body: data, auth: true }),
  updateContact: (id, data) => request(`/contacts/${id}`, { method: "PUT", body: data, auth: true }),
  deleteContact: (id) => request(`/contacts/${id}`, { method: "DELETE", auth: true }),

  resendContactConfirmation: (id) => request(`/contacts/${id}/confirm/resend`, { method: "POST", auth: true }),
  enableContactTelegram: (id) => request(`/contacts/${id}/telegram/enable`, { method: "POST", auth: true }),
  disableContactTelegram: (id) => request(`/contacts/${id}/telegram`, { method: "DELETE", auth: true }),
  enableContactWhatsapp: (id) => request(`/contacts/${id}/whatsapp/enable`, { method: "POST", auth: true }),
  disableContactWhatsapp: (id) => request(`/contacts/${id}/whatsapp`, { method: "DELETE", auth: true }),
  enableContactSms: (id) => request(`/contacts/${id}/sms/enable`, { method: "POST", auth: true }),
  disableContactSms: (id) => request(`/contacts/${id}/sms`, { method: "DELETE", auth: true }),

  createAlert: (data) => request("/alerts", { method: "POST", body: data, auth: true }),
  stopAlert: (id) => request(`/alerts/${id}/stop`, { method: "POST", auth: true }),
  listAlerts: () => request("/alerts", { auth: true }),
  getIntegrations: () => request("/integrations", { auth: true }),
  getTikTokRecordingLimit: () => request("/integrations/tiktok/recording-limit", { auth: true }),
  authorizeIntegration: (provider) => request(`/integrations/${provider}/authorize`, { method: "POST", auth: true }),
  disconnectIntegration: (provider) => request(`/integrations/${provider}`, { method: "DELETE", auth: true }),
  uploadVideo,
  getVideo: (id) => request(`/alerts/${id}/video`, { auth: true }),
  sendVideoToDrive: (id) => request(`/alerts/${id}/video/drive`, { method: "POST", auth: true }),
  getTikTokOptions: (id) => request(`/alerts/${id}/video/tiktok/options`, { auth: true }),
  publishTikTok: (id, data) => request(`/alerts/${id}/video/tiktok`, { method: "POST", body: data, auth: true }),
  getTikTokStatus: (id) => request(`/alerts/${id}/video/tiktok`, { auth: true }),

  getFeatures: () => request("/features"),
};
// TypeScript source.
