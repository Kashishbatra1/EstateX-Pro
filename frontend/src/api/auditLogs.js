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

export async function listAuditLogs(params = {}) {
  const result = await apiRequest(`/api/audit-logs${toQuery(params)}`);
  return {
    items: result.data?.items ?? [],
    pagination: result.data?.pagination ?? {
      page: 1,
      limit: 30,
      total: 0,
      totalPages: 0,
    },
  };
}

export async function getAuditLog(id) {
  const result = await apiRequest(`/api/audit-logs/${id}`);
  return result.data?.auditLog ?? null;
}
