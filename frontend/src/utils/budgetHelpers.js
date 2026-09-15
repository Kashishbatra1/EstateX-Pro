export const PERIOD_TYPES = ["monthly", "annual"];

export function emptyBudgetForm() {
  const now = new Date();
  return {
    name: "",
    periodType: "monthly",
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    totalAmount: "",
    alertThresholdPct: "80",
    notes: "",
  };
}

export function budgetToForm(budget) {
  return {
    name: budget?.name || "",
    periodType: budget?.periodType || "monthly",
    year: budget?.year != null ? String(budget.year) : "",
    month: budget?.month != null ? String(budget.month) : "",
    totalAmount: budget?.totalAmount != null ? String(budget.totalAmount) : "",
    alertThresholdPct:
      budget?.alertThresholdPct != null ? String(budget.alertThresholdPct) : "80",
    notes: budget?.notes || "",
  };
}

export function buildBudgetPayload(values) {
  const payload = {
    name: values.name.trim(),
    periodType: values.periodType,
    year: Number(values.year),
    totalAmount: Number(values.totalAmount),
    alertThresholdPct: Number(values.alertThresholdPct || 80),
    notes: values.notes?.trim() || null,
  };
  if (values.periodType === "monthly") {
    payload.month = Number(values.month);
  } else {
    payload.month = null;
  }
  return payload;
}

export function formatPeriod(budget) {
  if (!budget) return "—";
  if (budget.periodType === "annual") return `Annual ${budget.year}`;
  const months = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[budget.month] || budget.month} ${budget.year}`;
}

export function formatApiError(err) {
  if (!err) return "Request failed";
  if (Array.isArray(err.errors) && err.errors.length) {
    return err.errors.map((e) => e.message || e.field).join("; ");
  }
  return err.message || "Request failed";
}
