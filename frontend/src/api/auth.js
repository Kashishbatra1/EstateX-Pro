import { apiRequest } from "./client.js";

export async function registerRequest({ fullName, email, password, role }) {
  const result = await apiRequest("/api/auth/register", {
    method: "POST",
    auth: false,
    body: { fullName, email, password, role },
  });
  return result.data;
}

export async function loginRequest(email, password) {
  const result = await apiRequest("/api/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
  return result.data;
}

export async function logoutRequest() {
  return apiRequest("/api/auth/logout", { method: "POST" });
}

export async function meRequest(options = {}) {
  const result = await apiRequest("/api/auth/me", options);
  return result.data?.admin ?? null;
}
