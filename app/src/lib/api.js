import { getToken } from "./session.js";
import { t } from "./i18n.js";

const BASE_URL = import.meta.env.API_BASE_URL;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function extractMessage(body) {
  if (!body) return t("errors.generic");
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  return t("errors.generic");
}

async function request(path, { method = "GET", body, auth = false } = {}) {
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

export const Api = {
  register: (data) => request("/auth/register", { method: "POST", body: data }),
  login: (data) => request("/auth/login", { method: "POST", body: data }),

  getMe: () => request("/users/me", { auth: true }),
  updateMe: (data) => request("/users/me", { method: "PUT", body: data, auth: true }),

  listContacts: () => request("/contacts", { auth: true }),
  createContact: (data) => request("/contacts", { method: "POST", body: data, auth: true }),
  updateContact: (id, data) => request(`/contacts/${id}`, { method: "PUT", body: data, auth: true }),
  deleteContact: (id) => request(`/contacts/${id}`, { method: "DELETE", auth: true }),

  enableContactTelegram: (id) => request(`/contacts/${id}/telegram/enable`, { method: "POST", auth: true }),
  disableContactTelegram: (id) => request(`/contacts/${id}/telegram`, { method: "DELETE", auth: true }),

  createAlert: (data) => request("/alerts", { method: "POST", body: data, auth: true }),
};
