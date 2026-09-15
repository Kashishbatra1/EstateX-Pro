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

export async function listPayments(params = {}) {
  const result = await apiRequest(`/api/payments${toQuery(params)}`);
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

export async function getPayment(id) {
  const result = await apiRequest(`/api/payments/${id}`);
  return result.data?.payment ?? null;
}

export async function createPayment(payload) {
  const result = await apiRequest("/api/payments", {
    method: "POST",
    body: payload,
  });
  return result.data?.payment ?? null;
}

export async function updatePayment(id, payload) {
  const result = await apiRequest(`/api/payments/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.payment ?? null;
}

export async function reversePayment(id) {
  const result = await apiRequest(`/api/payments/${id}`, {
    method: "DELETE",
  });
  return result.data?.payment ?? null;
}
