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

export async function listExpenses(params = {}) {
  const result = await apiRequest(`/api/expenses${toQuery(params)}`);
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

export async function getExpense(id) {
  const result = await apiRequest(`/api/expenses/${id}`);
  return result.data?.expense ?? null;
}

export async function createExpense(payload) {
  const result = await apiRequest("/api/expenses", {
    method: "POST",
    body: payload,
  });
  return result.data?.expense ?? null;
}

export async function updateExpense(id, payload) {
  const result = await apiRequest(`/api/expenses/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.expense ?? null;
}

export async function updateExpenseApproval(id, payload) {
  const result = await apiRequest(`/api/expenses/${id}/approval`, {
    method: "PATCH",
    body: payload,
  });
  return result.data?.expense ?? null;
}

export async function deleteExpense(id) {
  const result = await apiRequest(`/api/expenses/${id}`, {
    method: "DELETE",
  });
  return result.data?.expense ?? null;
}
