export const REPORT_TABS = [
  { id: "bookings", label: "Bookings" },
  { id: "payments", label: "Payments" },
  { id: "expenses", label: "Expenses" },
  { id: "properties", label: "Properties" },
];

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
];

export const PROPERTY_STATUSES = [
  "draft",
  "available",
  "reserved",
  "sold",
  "rented",
];

export const APPROVAL_STATUSES = ["requested", "approved", "rejected"];

export const DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "this_year", label: "This Year" },
  { id: "custom", label: "Custom" },
];

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getDatePresetRange(presetId) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (presetId === "today") {
    const day = toYmd(startOfToday);
    return { dateFrom: day, dateTo: day };
  }

  if (presetId === "this_week") {
    const day = startOfToday.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(startOfToday);
    monday.setDate(startOfToday.getDate() + mondayOffset);
    return { dateFrom: toYmd(monday), dateTo: toYmd(startOfToday) };
  }

  if (presetId === "this_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: toYmd(from), dateTo: toYmd(startOfToday) };
  }

  if (presetId === "last_month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { dateFrom: toYmd(from), dateTo: toYmd(to) };
  }

  if (presetId === "this_year") {
    const from = new Date(now.getFullYear(), 0, 1);
    return { dateFrom: toYmd(from), dateTo: toYmd(startOfToday) };
  }

  return { dateFrom: "", dateTo: "" };
}

export function validateDateRange(dateFrom, dateTo) {
  if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    return "Start date must be YYYY-MM-DD";
  }
  if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    return "End date must be YYYY-MM-DD";
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return "Start date cannot be after end date";
  }
  return "";
}

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

/** Build chart series from backend count maps — values only, no recalculation. */
export function mapCountSeries(map = {}, preferredOrder = []) {
  const keys =
    preferredOrder.length > 0
      ? preferredOrder.filter((k) => map[k] !== undefined)
      : Object.keys(map);
  const extra = Object.keys(map).filter((k) => !keys.includes(k));
  return [...keys, ...extra].map((key) => ({
    label: formatLabel(key),
    value: Number(map[key]) || 0,
  }));
}
