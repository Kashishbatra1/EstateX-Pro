export const NOTIFICATION_TYPES = [
  "rent_due",
  "utility_bill",
  "missing_document",
  "high_expense",
  "maintenance_deadline",
  "booking_expiry",
  "budget_overspending",
  "vendor_contract_renewal",
  "document_expiry",
  "general",
];

export function formatLabel(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatApiError(err) {
  if (!err) return "Request failed";
  if (Array.isArray(err.details) && err.details.length === 1 && err.details[0].message) {
    return err.details[0].message;
  }
  return err.message || "Request failed";
}

export function formatRelativeTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startToday - startThat) / 86400000);

  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (dayDiff === 0) return `Today · ${time}`;
  if (dayDiff === 1) return `Yesterday · ${time}`;
  if (dayDiff > 1 && dayDiff < 7) {
    return `${date.toLocaleDateString([], { weekday: "short" })} · ${time}`;
  }
  return `${date.toLocaleDateString()} · ${time}`;
}

/**
 * Safe deep-link from entityType/entityId.
 * Only link when the frontend has a matching detail route.
 */
export function resolveNotificationLink(notification) {
  if (!notification?.entityType || notification.entityId == null) {
    return null;
  }
  const id = Number(notification.entityId);
  if (!Number.isInteger(id) || id <= 0) return null;

  if (notification.entityType === "booking") {
    return { to: `/bookings/${id}`, label: "Open booking" };
  }
  if (notification.entityType === "property_document") {
    return { to: "/properties", label: "Open properties" };
  }
  if (notification.entityType === "client_kyc_document") {
    return { to: "/clients", label: "Open clients" };
  }
  if (notification.entityType === "vendor") {
    return { to: `/vendors/${id}`, label: "Open vendor" };
  }
  if (notification.entityType === "vendor_document") {
    return { to: "/vendors", label: "Open vendors" };
  }
  if (notification.entityType === "maintenance_tasks") {
    return { to: `/maintenance/${id}`, label: "Open maintenance" };
  }
  if (notification.entityType === "budgets") {
    return { to: `/budgets/${id}`, label: "Open budget" };
  }
  if (notification.entityType === "recurring_expense") {
    return { to: `/recurring/${id}`, label: "Open recurring" };
  }
  // booking_installment has no dedicated page — do not guess parent booking id
  return null;
}
