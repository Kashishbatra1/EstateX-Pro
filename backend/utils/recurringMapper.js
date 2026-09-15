/**
 * Recurring Expenses — API mapping over recurring_expenses.
 */

const FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"];

function toDateOnly(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

const WRITABLE_FIELDS = {
  title: "title",
  categoryId: "category_id",
  vendorId: "vendor_id",
  amount: "amount",
  frequency: "frequency",
  dueDay: "due_day",
  nextDueDate: "next_due_date",
  reminderDaysBefore: "reminder_days_before",
  autoDebitFlag: "auto_debit_flag",
  annualEscalationPct: "annual_escalation_pct",
  isActive: "is_active",
  notes: "notes",
};

function toPublicRecurring(row, extras = {}) {
  if (!row) return null;
  return {
    id: Number(row.id),
    title: row.title,
    categoryId: row.category_id !== null && row.category_id !== undefined
      ? Number(row.category_id)
      : null,
    categoryName: row.category_name || null,
    vendorId: row.vendor_id !== null && row.vendor_id !== undefined
      ? Number(row.vendor_id)
      : null,
    vendorName: row.vendor_name || null,
    amount: Number(row.amount),
    frequency: row.frequency,
    dueDay: row.due_day !== null && row.due_day !== undefined ? Number(row.due_day) : null,
    nextDueDate: toDateOnly(row.next_due_date),
    reminderDaysBefore: Number(row.reminder_days_before),
    autoDebitFlag: Boolean(row.auto_debit_flag),
    annualEscalationPct: Number(row.annual_escalation_pct),
    isActive: Boolean(row.is_active),
    notes: row.notes,
    createdBy: row.created_by !== null && row.created_by !== undefined
      ? Number(row.created_by)
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    ...extras,
  };
}

module.exports = {
  FREQUENCIES,
  WRITABLE_FIELDS,
  toPublicRecurring,
  toDateOnly,
};
