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

export async function listTransfers(params = {}) {
  const result = await apiRequest(`/api/transfers${toQuery(params)}`);
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

export async function listPropertyTransfers(propertyId) {
  const result = await apiRequest(`/api/properties/${propertyId}/transfers`);
  return {
    items: result.data?.items ?? [],
    pagination: result.data?.pagination ?? {
      page: 1,
      limit: 100,
      total: 0,
      totalPages: 0,
    },
  };
}

export async function getTransfer(id) {
  const result = await apiRequest(`/api/transfers/${id}`);
  return result.data?.transfer ?? null;
}

export async function createTransfer(payload) {
  const result = await apiRequest("/api/transfers", {
    method: "POST",
    body: payload,
  });
  return result.data?.transfer ?? null;
}

export async function updateTransfer(id, payload) {
  const result = await apiRequest(`/api/transfers/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.transfer ?? null;
}

export async function deleteTransfer(id) {
  const result = await apiRequest(`/api/transfers/${id}`, {
    method: "DELETE",
  });
  return result.data?.transfer ?? null;
}
