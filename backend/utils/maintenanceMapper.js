/**
 * Property Maintenance — API mapping over maintenance_tasks.
 */

const STATUSES = ["scheduled", "in_progress", "completed", "cancelled", "overdue"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

const WRITABLE_FIELDS = {
  propertyId: "property_id",
  title: "title",
  description: "description",
  category: "category",
  status: "status",
  priority: "priority",
  dueDate: "due_date",
  assignedTo: "assigned_to",
  vendorId: "vendor_id",
  estimatedCost: "estimated_cost",
  actualCost: "actual_cost",
  reminderDaysBefore: "reminder_days_before",
  notes: "notes",
};

function toDateOnly(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function toPublicMaintenance(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    propertyId: Number(row.property_id),
    propertyTitle: row.property_title || null,
    propertyCode: row.property_code || null,
    title: row.title,
    description: row.description || null,
    category: row.category || null,
    status: row.status,
    priority: row.priority,
    dueDate: toDateOnly(row.due_date),
    completedAt: row.completed_at || null,
    assignedTo: row.assigned_to != null ? Number(row.assigned_to) : null,
    assignedToName: row.assigned_to_name || null,
    vendorId: row.vendor_id != null ? Number(row.vendor_id) : null,
    vendorName: row.vendor_name || null,
    estimatedCost:
      row.estimated_cost != null ? Number(row.estimated_cost) : null,
    actualCost: row.actual_cost != null ? Number(row.actual_cost) : null,
    reminderDaysBefore: Number(row.reminder_days_before),
    notes: row.notes || null,
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  STATUSES,
  PRIORITIES,
  WRITABLE_FIELDS,
  toPublicMaintenance,
  toDateOnly,
};
