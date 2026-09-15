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

export async function listRecycleBin(params = {}) {
  const result = await apiRequest(`/api/recycle-bin${toQuery(params)}`);
  return {
    items: result.data?.items ?? [],
    pagination: result.data?.pagination ?? { page: 1, totalPages: 0 },
  };
}

export async function restoreRecycleItem(entityType, entityId) {
  const result = await apiRequest("/api/recycle-bin/restore", {
    method: "POST",
    body: { entityType, entityId },
  });
  return result.data ?? null;
}

export async function purgeRecycleItem(entityType, entityId) {
  const result = await apiRequest("/api/recycle-bin/purge", {
    method: "POST",
    body: { entityType, entityId },
  });
  return result.data ?? null;
}

export async function globalSearch(q) {
  const result = await apiRequest(`/api/search${toQuery({ q })}`);
  return result.data ?? {};
}
