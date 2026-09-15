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

export async function listNotifications(params = {}) {
  const result = await apiRequest(`/api/notifications${toQuery(params)}`);
  return {
    items: result.data?.items ?? [],
    unreadCount: Number(result.data?.unreadCount ?? 0),
    pagination: result.data?.pagination ?? {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
  };
}

export async function getNotification(id) {
  const result = await apiRequest(`/api/notifications/${id}`);
  return result.data?.notification ?? null;
}

export async function markNotificationRead(id) {
  const result = await apiRequest(`/api/notifications/${id}/read`, {
    method: "PATCH",
  });
  return result.data?.notification ?? null;
}

export async function markNotificationUnread(id) {
  const result = await apiRequest(`/api/notifications/${id}/unread`, {
    method: "PATCH",
  });
  return result.data?.notification ?? null;
}

export async function markAllNotificationsRead() {
  const result = await apiRequest("/api/notifications/read-all", {
    method: "PATCH",
  });
  return result.data ?? { updatedCount: 0 };
}

export async function deleteNotification(id) {
  const result = await apiRequest(`/api/notifications/${id}`, {
    method: "DELETE",
  });
  return result.data ?? { deleted: true };
}

export async function processReminders(daysAhead) {
  const result = await apiRequest(
    `/api/notifications/reminders/process${toQuery(
      daysAhead ? { daysAhead } : {}
    )}`,
    { method: "POST" }
  );
  return result.data ?? { createdCount: 0, items: [] };
}

/** Notify header badge listeners after local mutations (not real-time). */
export function emitNotificationsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("estatex:notifications-changed"));
  }
}
