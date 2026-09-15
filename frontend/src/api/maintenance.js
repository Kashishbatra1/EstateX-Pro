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

export async function listMaintenance(params = {}) {
  const result = await apiRequest(`/api/maintenance${toQuery(params)}`);
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

export async function getMaintenance(id) {
  const result = await apiRequest(`/api/maintenance/${id}`);
  return result.data?.task ?? null;
}

export async function createMaintenance(payload) {
  const result = await apiRequest("/api/maintenance", {
    method: "POST",
    body: payload,
  });
  return result.data?.task ?? null;
}

export async function updateMaintenance(id, payload) {
  const result = await apiRequest(`/api/maintenance/${id}`, {
    method: "PUT",
    body: payload,
  });
  return result.data?.task ?? null;
}

export async function deleteMaintenance(id) {
  const result = await apiRequest(`/api/maintenance/${id}`, {
    method: "DELETE",
  });
  return result.data?.task ?? null;
}

export async function processMaintenanceReminders() {
  const result = await apiRequest("/api/maintenance/reminders/process", {
    method: "POST",
  });
  return result.data ?? null;
}
