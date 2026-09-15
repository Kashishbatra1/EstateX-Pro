const TOKEN_KEY = "estatex_token";
const ADMIN_KEY = "estatex_admin";
export const UNAUTH_EVENT = "estatex:unauthorized";

const configuredBase = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  ""
);

/** Empty base uses same-origin / Vite proxy in development. */
export function getApiBaseUrl() {
  return configuredBase;
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredSession(token, admin) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

export function getStoredAdmin() {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

export class ApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UNAUTH_EVENT));
  const path = window.location.pathname || "";
  if (path === "/login" || path.startsWith("/login?")) return;
  window.location.assign("/login");
}

/**
 * Centralized fetch wrapper.
 * Attaches JWT, parses EstateX API envelope, handles 401.
 */
export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    auth = true,
    headers: extraHeaders = {},
    signal,
  } = options;

  const headers = {
    Accept: "application/json",
    ...extraHeaders,
  };

  if (body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getStoredToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    throw new ApiError(
      "Unable to reach the server. Check that the backend is running."
    );
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (response.status === 401 && auth) {
    clearStoredSession();
    redirectToLogin();
    throw new ApiError(payload?.message || "Authentication required", {
      status: 401,
      details: payload?.details,
    });
  }

  if (!response.ok || payload?.success === false) {
    const fallback =
      response.status === 502 || response.status === 503 || response.status === 504
        ? "Backend API is not reachable. Start the backend (port 5000), then try again."
        : `Request failed (${response.status})`;
    throw new ApiError(payload?.message || fallback, {
      status: response.status,
      details: payload?.details,
    });
  }

  return payload;
}

/**
 * Multipart upload helper — do not set Content-Type (browser sets boundary).
 */
export async function apiUpload(path, formData, { method = "POST", signal } = {}) {
  const headers = { Accept: "application/json" };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  let response;
  try {
    response = await fetch(url, { method, headers, body: formData, signal });
  } catch {
    throw new ApiError(
      "Unable to reach the server. Check that the backend is running."
    );
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (response.status === 401) {
    clearStoredSession();
    redirectToLogin();
    throw new ApiError(payload?.message || "Authentication required", {
      status: 401,
      details: payload?.details,
    });
  }

  if (!response.ok || payload?.success === false) {
    const fallback =
      response.status === 502 || response.status === 503 || response.status === 504
        ? "Backend API is not reachable. Start the backend (port 5000), then try again."
        : `Upload failed (${response.status})`;
    throw new ApiError(payload?.message || fallback, {
      status: response.status,
      details: payload?.details || payload?.errors,
    });
  }

  return payload;
}

/** Resolve stored file_path for browser use (local uploads need access_token). */
export function resolveFileUrl(filePath) {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath)) return filePath;
  if (filePath.startsWith("/api/uploads/")) {
    const token = getStoredToken();
    const base = `${getApiBaseUrl()}${filePath}`;
    if (!token) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}access_token=${encodeURIComponent(token)}`;
  }
  return filePath;
}

export function isLocalUploadPath(filePath) {
  return typeof filePath === "string" && filePath.startsWith("/api/uploads/");
}

