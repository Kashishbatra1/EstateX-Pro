export const INVENTORY_STATUSES = [
  "in_stock",
  "assigned",
  "maintenance",
  "retired",
];

export function formatLabel(value) {
  if (!value) return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatApiError(err) {
  if (!err) return "Something went wrong";
  if (err.details?.length) {
    return err.details.map((d) => d.message || d.field).join("; ");
  }
  return err.message || "Something went wrong";
}
