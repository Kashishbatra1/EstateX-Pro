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

export async function listInventory(params = {}) {
  const result = await apiRequest(`/api/inventory${toQuery(params)}`);
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

export async function getInventoryItem(id) {
  const result = await apiRequest(`/api/inventory/${id}`);
  return result.data?.item ?? null;
}

export async function createInventoryItem(payload) {
  const result = await apiRequest("/api/inventory", {
    method: "POST",
    body: payload,
  });
  return result.data?.item ?? null;
}

export async function updateInventoryItem(id, payload) {
  const result = await apiRequest(`/api/inventory/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.item ?? null;
}

export async function deleteInventoryItem(id) {
  const result = await apiRequest(`/api/inventory/${id}`, {
    method: "DELETE",
  });
  return result.data?.item ?? null;
}

export async function assignInventoryItem(id, payload) {
  const result = await apiRequest(`/api/inventory/${id}/assign`, {
    method: "POST",
    body: payload,
  });
  return result.data?.item ?? null;
}

export async function returnInventoryItem(id, payload = {}) {
  const result = await apiRequest(`/api/inventory/${id}/return`, {
    method: "POST",
    body: payload,
  });
  return result.data?.item ?? null;
}

export async function adjustInventoryItem(id, payload) {
  const result = await apiRequest(`/api/inventory/${id}/adjust`, {
    method: "POST",
    body: payload,
  });
  return result.data?.item ?? null;
}

export async function listInventoryTransactions(id) {
  const result = await apiRequest(`/api/inventory/${id}/transactions`);
  return result.data?.items ?? [];
}

export async function listEmployees() {
  const result = await apiRequest("/api/employees");
  return result.data?.items ?? [];
}
