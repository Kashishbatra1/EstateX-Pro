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

export async function listPettyCash(params = {}) {
  const result = await apiRequest(`/api/petty-cash${toQuery(params)}`);
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

export async function getPettyCash(id) {
  const result = await apiRequest(`/api/petty-cash/${id}`);
  return result.data?.account ?? null;
}

export async function createPettyCash(payload) {
  const result = await apiRequest("/api/petty-cash", {
    method: "POST",
    body: payload,
  });
  return result.data?.account ?? null;
}

export async function updatePettyCash(id, payload) {
  const result = await apiRequest(`/api/petty-cash/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.account ?? null;
}

export async function deletePettyCash(id) {
  const result = await apiRequest(`/api/petty-cash/${id}`, {
    method: "DELETE",
  });
  return result.data?.account ?? null;
}

export async function createPettyTxn(accountId, payload) {
  const result = await apiRequest(`/api/petty-cash/${accountId}/transactions`, {
    method: "POST",
    body: payload,
  });
  return result.data ?? null;
}

export async function createPettyReconciliation(accountId, payload) {
  const result = await apiRequest(`/api/petty-cash/${accountId}/reconciliations`, {
    method: "POST",
    body: payload,
  });
  return result.data?.reconciliation ?? null;
}
