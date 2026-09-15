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

export async function listBudgets(params = {}) {
  const result = await apiRequest(`/api/budgets${toQuery(params)}`);
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

export async function getBudget(id) {
  const result = await apiRequest(`/api/budgets/${id}`);
  return result.data?.budget ?? null;
}

export async function createBudget(payload) {
  const result = await apiRequest("/api/budgets", {
    method: "POST",
    body: payload,
  });
  return result.data?.budget ?? null;
}

export async function updateBudget(id, payload) {
  const result = await apiRequest(`/api/budgets/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.budget ?? null;
}

export async function deleteBudget(id) {
  const result = await apiRequest(`/api/budgets/${id}`, {
    method: "DELETE",
  });
  return result.data?.budget ?? null;
}

export async function addBudgetLine(budgetId, payload) {
  const result = await apiRequest(`/api/budgets/${budgetId}/lines`, {
    method: "POST",
    body: payload,
  });
  return result.data?.line ?? null;
}

export async function updateBudgetLine(budgetId, lineId, payload) {
  const result = await apiRequest(`/api/budgets/${budgetId}/lines/${lineId}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.line ?? null;
}

export async function deleteBudgetLine(budgetId, lineId) {
  const result = await apiRequest(`/api/budgets/${budgetId}/lines/${lineId}`, {
    method: "DELETE",
  });
  return result.data ?? null;
}

export async function processBudgetAlerts() {
  const result = await apiRequest("/api/budgets/alerts/process", {
    method: "POST",
  });
  return result.data ?? null;
}
