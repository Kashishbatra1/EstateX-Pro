export const APPROVAL_STATUSES = ["requested", "approved", "rejected"];

export const REIMBURSEMENT_STATUSES = ["none", "pending", "reimbursed"];

export function formatLabel(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapApiFieldErrors(details) {
  const mapped = {};
  if (Array.isArray(details)) {
    for (const item of details) {
      if (item?.field) mapped[item.field] = item.message || "Invalid value";
    }
  }
  return mapped;
}

export function formatApiError(err) {
  if (!err) return "Request failed";
  const details = err.details;
  if (details?.allowedTransitions?.length) {
    return `${err.message} (allowed: ${details.allowedTransitions.join(", ")})`;
  }
  if (Array.isArray(details) && details.length === 1 && details[0].message) {
    return details[0].message;
  }
  return err.message || "Request failed";
}

/** Collect category/employee options from expense list rows (no dedicated list APIs). */
export function collectLookupsFromExpenses(items = []) {
  const categories = new Map();
  const employees = new Map();
  for (const e of items) {
    if (e.categoryId != null) {
      categories.set(e.categoryId, {
        id: e.categoryId,
        name: e.categoryName || `Category #${e.categoryId}`,
      });
    }
    if (e.paidByEmployeeId != null) {
      employees.set(e.paidByEmployeeId, {
        id: e.paidByEmployeeId,
        name: e.paidByEmployeeName || `Employee #${e.paidByEmployeeId}`,
      });
    }
  }
  return {
    categories: Array.from(categories.values()),
    employees: Array.from(employees.values()),
  };
}

export function emptyExpenseForm() {
  return {
    categoryId: "",
    subcategoryId: "",
    paidByEmployeeId: "",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    gstSalesTax: "0",
    remainingAmount: "0",
    paymentMethodId: "",
    propertyId: "",
    vendorId: "",
    description: "",
    deviceOrItemName: "",
    quantity: "",
    receiptPath: "",
    reimbursementStatus: "none",
  };
}

export function expenseToForm(expense) {
  return {
    categoryId: expense?.categoryId != null ? String(expense.categoryId) : "",
    subcategoryId:
      expense?.subcategoryId != null ? String(expense.subcategoryId) : "",
    paidByEmployeeId:
      expense?.paidByEmployeeId != null ? String(expense.paidByEmployeeId) : "",
    amount: expense?.amount ?? "",
    expenseDate: expense?.expenseDate
      ? String(expense.expenseDate).slice(0, 10)
      : "",
    gstSalesTax: expense?.gstSalesTax ?? "0",
    remainingAmount: expense?.remainingAmount ?? "0",
    paymentMethodId:
      expense?.paymentMethodId != null ? String(expense.paymentMethodId) : "",
    propertyId: expense?.propertyId != null ? String(expense.propertyId) : "",
    vendorId: expense?.vendorId != null ? String(expense.vendorId) : "",
    description: expense?.description ?? "",
    deviceOrItemName: expense?.deviceOrItemName ?? "",
    quantity: expense?.quantity ?? "",
    receiptPath: expense?.receiptPath ?? "",
    reimbursementStatus: expense?.reimbursementStatus || "none",
  };
}

function optionalNumber(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return null;
  }
  return Number(raw);
}

export function buildExpensePayload(values) {
  const payload = {
    categoryId: Number(values.categoryId),
    paidByEmployeeId: Number(values.paidByEmployeeId),
    amount: Number(values.amount),
    reimbursementStatus: values.reimbursementStatus || "none",
  };

  if (String(values.expenseDate || "").trim()) {
    payload.expenseDate = String(values.expenseDate).trim();
  }

  const gst = optionalNumber(values.gstSalesTax);
  payload.gstSalesTax = gst == null ? 0 : gst;

  const remaining = optionalNumber(values.remainingAmount);
  payload.remainingAmount = remaining == null ? 0 : remaining;

  payload.subcategoryId = optionalNumber(values.subcategoryId);
  payload.vendorId = optionalNumber(values.vendorId);
  payload.paymentMethodId = optionalNumber(values.paymentMethodId);
  payload.propertyId = optionalNumber(values.propertyId);

  payload.description =
    String(values.description || "").trim() === ""
      ? null
      : String(values.description).trim();

  const device = String(values.deviceOrItemName || "").trim();
  payload.deviceOrItemName = device === "" ? null : device;

  if (device !== "") {
    payload.quantity = optionalNumber(values.quantity);
  } else {
    payload.quantity = optionalNumber(values.quantity);
  }

  payload.receiptPath =
    String(values.receiptPath || "").trim() === ""
      ? null
      : String(values.receiptPath).trim();

  return payload;
}

export function validateExpenseForm(values) {
  const errors = {};

  if (!values.categoryId || Number(values.categoryId) <= 0) {
    errors.categoryId = "Category id is required";
  }
  if (!values.paidByEmployeeId || Number(values.paidByEmployeeId) <= 0) {
    errors.paidByEmployeeId = "Paid-by employee id is required";
  }

  const amount = Number(values.amount);
  if (
    values.amount === "" ||
    values.amount === null ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    errors.amount = "Amount must be greater than zero";
  }

  const gst = optionalNumber(values.gstSalesTax);
  if (gst != null && (Number.isNaN(gst) || gst < 0)) {
    errors.gstSalesTax = "Must be a non-negative number";
  }

  const remaining = optionalNumber(values.remainingAmount);
  if (remaining != null && (Number.isNaN(remaining) || remaining < 0)) {
    errors.remainingAmount = "Must be a non-negative number";
  }
  if (
    Number.isFinite(amount) &&
    remaining != null &&
    !Number.isNaN(remaining) &&
    remaining > amount
  ) {
    errors.remainingAmount = "Remaining amount cannot exceed expense amount";
  }

  const device = String(values.deviceOrItemName || "").trim();
  if (device) {
    const qty = optionalNumber(values.quantity);
    if (qty === null || Number.isNaN(qty) || qty < 0) {
      errors.quantity = "Quantity is required when device/item name is set";
    }
  }

  if (values.expenseDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.expenseDate)) {
    errors.expenseDate = "Use YYYY-MM-DD format";
  }

  return errors;
}

export function canEditExpense(status) {
  return status === "requested";
}

export function canApproveExpense(status) {
  return status === "requested";
}
