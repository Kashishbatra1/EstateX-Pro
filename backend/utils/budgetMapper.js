/**
 * Budgets — API mapping over budgets + budget_lines.
 */

const PERIOD_TYPES = ["monthly", "annual"];

const WRITABLE_FIELDS = {
  name: "name",
  periodType: "period_type",
  year: "year",
  month: "month",
  totalAmount: "total_amount",
  alertThresholdPct: "alert_threshold_pct",
  notes: "notes",
};

function toPublicBudgetLine(row) {
  if (!row) return null;
  const allocated = Number(row.allocated_amount);
  const spent = row.spent_amount != null ? Number(row.spent_amount) : 0;
  return {
    id: Number(row.id),
    budgetId: Number(row.budget_id),
    categoryId: Number(row.category_id),
    categoryName: row.category_name || null,
    allocatedAmount: allocated,
    spentAmount: spent,
    remainingAmount: allocated - spent,
    utilizationPct: allocated > 0 ? Math.round((spent / allocated) * 10000) / 100 : 0,
    notes: row.notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublicBudget(row, extras = {}) {
  if (!row) return null;
  const totalAmount = Number(row.total_amount);
  const spentAmount =
    extras.spentAmount != null
      ? Number(extras.spentAmount)
      : row.spent_amount != null
        ? Number(row.spent_amount)
        : 0;
  const alertThresholdPct = Number(row.alert_threshold_pct);
  const utilizationPct =
    totalAmount > 0 ? Math.round((spentAmount / totalAmount) * 10000) / 100 : 0;

  return {
    id: Number(row.id),
    name: row.name,
    periodType: row.period_type,
    year: Number(row.year),
    month: row.month != null ? Number(row.month) : null,
    totalAmount,
    alertThresholdPct,
    notes: row.notes || null,
    spentAmount,
    remainingAmount: totalAmount - spentAmount,
    utilizationPct,
    isOverAlert: utilizationPct >= alertThresholdPct,
    lines: extras.lines || undefined,
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  PERIOD_TYPES,
  WRITABLE_FIELDS,
  toPublicBudget,
  toPublicBudgetLine,
};
