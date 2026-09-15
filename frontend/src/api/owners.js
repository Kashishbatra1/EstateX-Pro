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

export async function listOwners(params = {}) {
  const result = await apiRequest(`/api/owners${toQuery(params)}`);
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

export async function getOwner(id) {
  const result = await apiRequest(`/api/owners/${id}`);
  return result.data?.owner ?? null;
}

export async function createOwner(payload) {
  const result = await apiRequest("/api/owners", {
    method: "POST",
    body: payload,
  });
  return result.data?.owner ?? null;
}

export async function updateOwner(id, payload) {
  const result = await apiRequest(`/api/owners/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.owner ?? null;
}

export async function updateOwnerVerification(id, verificationStatus) {
  const result = await apiRequest(`/api/owners/${id}/verification`, {
    method: "PATCH",
    body: { verificationStatus },
  });
  return result.data?.owner ?? null;
}

export async function deleteOwner(id) {
  const result = await apiRequest(`/api/owners/${id}`, {
    method: "DELETE",
  });
  return result.data?.owner ?? null;
}
