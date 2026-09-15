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

export async function listCommissions(params = {}) {
  const result = await apiRequest(`/api/commissions${toQuery(params)}`);
  return {
    items: result.data?.items ?? [],
    pagination: result.data?.pagination ?? {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
  };
}

export async function getCommission(id) {
  const result = await apiRequest(`/api/commissions/${id}`);
  return result.data?.commission ?? null;
}

export async function createCommission(payload) {
  const result = await apiRequest("/api/commissions", {
    method: "POST",
    body: payload,
  });
  return result.data?.commission ?? null;
}

export async function updateCommission(id, payload) {
  const result = await apiRequest(`/api/commissions/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.commission ?? null;
}

export async function deleteCommission(id) {
  const result = await apiRequest(`/api/commissions/${id}`, {
    method: "DELETE",
  });
  return result.data?.commission ?? null;
}
