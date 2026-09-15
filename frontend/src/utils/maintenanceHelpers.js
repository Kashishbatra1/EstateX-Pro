export const STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "overdue",
];
export const PRIORITIES = ["low", "medium", "high", "urgent"];

export function emptyMaintenanceForm() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return {
    propertyId: "",
    title: "",
    description: "",
    category: "",
    status: "scheduled",
    priority: "medium",
    dueDate: d.toISOString().slice(0, 10),
    assignedTo: "",
    vendorId: "",
    estimatedCost: "",
    actualCost: "",
    reminderDaysBefore: "3",
    notes: "",
  };
}

export function taskToForm(task) {
  return {
    propertyId: task?.propertyId != null ? String(task.propertyId) : "",
    title: task?.title || "",
    description: task?.description || "",
    category: task?.category || "",
    status: task?.status || "scheduled",
    priority: task?.priority || "medium",
    dueDate: task?.dueDate || "",
    assignedTo: task?.assignedTo != null ? String(task.assignedTo) : "",
    vendorId: task?.vendorId != null ? String(task.vendorId) : "",
    estimatedCost: task?.estimatedCost != null ? String(task.estimatedCost) : "",
    actualCost: task?.actualCost != null ? String(task.actualCost) : "",
    reminderDaysBefore:
      task?.reminderDaysBefore != null ? String(task.reminderDaysBefore) : "3",
    notes: task?.notes || "",
  };
}

export function buildMaintenancePayload(values) {
  return {
    propertyId: Number(values.propertyId),
    title: values.title.trim(),
    description: values.description?.trim() || null,
    category: values.category?.trim() || null,
    status: values.status,
    priority: values.priority,
    dueDate: values.dueDate,
    assignedTo: values.assignedTo ? Number(values.assignedTo) : null,
    vendorId: values.vendorId ? Number(values.vendorId) : null,
    estimatedCost:
      values.estimatedCost !== "" && values.estimatedCost != null
        ? Number(values.estimatedCost)
        : null,
    actualCost:
      values.actualCost !== "" && values.actualCost != null
        ? Number(values.actualCost)
        : null,
    reminderDaysBefore: Number(values.reminderDaysBefore || 3),
    notes: values.notes?.trim() || null,
  };
}

export function formatStatus(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatPriority(priority) {
  return String(priority || "medium")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isOverdueDate(dueDate) {
  if (!dueDate) return false;
  const due = String(dueDate).slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return due < today;
}

export function formatApiError(err) {
  if (!err) return "Request failed";
  if (Array.isArray(err.details) && err.details.length) {
    return err.details.map((e) => e.message || e.field).join("; ");
  }
  if (Array.isArray(err.errors) && err.errors.length) {
    return err.errors.map((e) => e.message || e.field).join("; ");
  }
  return err.message || "Request failed";
}
