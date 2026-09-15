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

export async function listBankAccounts(params = {}) {
  const result = await apiRequest(`/api/bank-accounts${toQuery(params)}`);
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

export async function getBankAccount(id) {
  const result = await apiRequest(`/api/bank-accounts/${id}`);
  return result.data?.bankAccount ?? null;
}

export async function createBankAccount(payload) {
  const result = await apiRequest("/api/bank-accounts", {
    method: "POST",
    body: payload,
  });
  return result.data?.bankAccount ?? null;
}

export async function updateBankAccount(id, payload) {
  const result = await apiRequest(`/api/bank-accounts/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.bankAccount ?? null;
}

export async function deleteBankAccount(id) {
  const result = await apiRequest(`/api/bank-accounts/${id}`, {
    method: "DELETE",
  });
  return result.data?.bankAccount ?? null;
}
