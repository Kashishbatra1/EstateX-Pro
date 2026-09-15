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

export async function listRecurring(params = {}) {
  const result = await apiRequest(`/api/recurring-expenses${toQuery(params)}`);
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

export async function getRecurring(id) {
  const result = await apiRequest(`/api/recurring-expenses/${id}`);
  return result.data?.recurringExpense ?? null;
}

export async function createRecurring(payload) {
  const result = await apiRequest("/api/recurring-expenses", {
    method: "POST",
    body: payload,
  });
  return result.data?.recurringExpense ?? null;
}

export async function updateRecurring(id, payload) {
  const result = await apiRequest(`/api/recurring-expenses/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.recurringExpense ?? null;
}

export async function deleteRecurring(id) {
  const result = await apiRequest(`/api/recurring-expenses/${id}`, {
    method: "DELETE",
  });
  return result.data?.recurringExpense ?? null;
}

export async function processRecurringReminders() {
  const result = await apiRequest("/api/recurring-expenses/reminders/process", {
    method: "POST",
  });
  return result.data ?? null;
}
