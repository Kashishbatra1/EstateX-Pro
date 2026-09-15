import { apiRequest } from "./client.js";

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function listFavorites(params = {}) {
  const result = await apiRequest(`/api/favorites${toQuery(params)}`);
  return result.data?.items ?? [];
}

export async function addFavorite(payload) {
  const result = await apiRequest("/api/favorites", {
    method: "POST",
    body: payload,
  });
  return result.data?.favorite ?? null;
}

export async function removeFavorite(id) {
  const result = await apiRequest(`/api/favorites/${id}`, { method: "DELETE" });
  return result.data ?? null;
}

export async function fetchCalendar(params = {}) {
  const result = await apiRequest(`/api/calendar${toQuery(params)}`);
  return {
    from: result.data?.from ?? null,
    to: result.data?.to ?? null,
    items: result.data?.items ?? [],
  };
}
