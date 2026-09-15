export const FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"];

export function formatApiError(err) {
  if (!err) return "Something went wrong";
  if (err.details?.length) {
    return err.details.map((d) => d.message || d.field).join("; ");
  }
  return err.message || "Something went wrong";
}

export function formatFrequency(value) {
  if (!value) return "—";
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

export function emptyRecurringForm() {
  return {
    title: "",
    categoryId: "",
    vendorId: "",
    amount: "",
    frequency: "monthly",
    dueDay: "",
    nextDueDate: "",
    reminderDaysBefore: "3",
    autoDebitFlag: false,
    annualEscalationPct: "0",
    isActive: true,
    notes: "",
  };
}

export function recurringToForm(item) {
  return {
    title: item?.title || "",
    categoryId: item?.categoryId != null ? String(item.categoryId) : "",
    vendorId: item?.vendorId != null ? String(item.vendorId) : "",
    amount: item?.amount != null ? String(item.amount) : "",
    frequency: item?.frequency || "monthly",
    dueDay: item?.dueDay != null ? String(item.dueDay) : "",
    nextDueDate: item?.nextDueDate ? String(item.nextDueDate).slice(0, 10) : "",
    reminderDaysBefore:
      item?.reminderDaysBefore != null ? String(item.reminderDaysBefore) : "3",
    autoDebitFlag: Boolean(item?.autoDebitFlag),
    annualEscalationPct:
      item?.annualEscalationPct != null ? String(item.annualEscalationPct) : "0",
    isActive: item?.isActive !== false,
    notes: item?.notes || "",
  };
}

export function buildRecurringPayload(values) {
  return {
    title: values.title.trim(),
    categoryId: values.categoryId === "" ? null : Number(values.categoryId),
    vendorId: values.vendorId === "" ? null : Number(values.vendorId),
    amount: values.amount === "" ? 0 : Number(values.amount),
    frequency: values.frequency || "monthly",
    dueDay: values.dueDay === "" ? null : Number(values.dueDay),
    nextDueDate: values.nextDueDate || null,
    reminderDaysBefore:
      values.reminderDaysBefore === ""
        ? 3
        : Number(values.reminderDaysBefore),
    autoDebitFlag: Boolean(values.autoDebitFlag),
    annualEscalationPct:
      values.annualEscalationPct === ""
        ? 0
        : Number(values.annualEscalationPct),
    isActive: Boolean(values.isActive),
    notes: values.notes.trim() || null,
  };
}
