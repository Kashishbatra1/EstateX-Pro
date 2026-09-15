/**
 * Validation for Expense Management endpoints.
 */
const ApiError = require("../utils/ApiError");
const {
  APPROVAL_STATUSES,
  REIMBURSEMENT_STATUSES,
} = require("../utils/expenseMapper");

function pushError(errors, field, message) {
  errors.push({ field, message });
}

function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function isValidDateOnly(value) {
  if (!isPresent(value)) return false;
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function validatePositiveAmount(body, field, errors, { required = false } = {}) {
  if (body[field] === undefined || body[field] === null || body[field] === "") {
    if (required) pushError(errors, field, `${field} is required`);
    return;
  }
  const n = Number(body[field]);
  if (Number.isNaN(n) || n <= 0) {
    pushError(errors, field, `${field} must be a number greater than zero`);
  }
}

function validateNonNegative(body, field, errors) {
  if (body[field] === undefined || body[field] === null || body[field] === "") return;
  const n = Number(body[field]);
  if (Number.isNaN(n) || n < 0) {
    pushError(errors, field, `${field} must be a non-negative number`);
  }
}

function validateCreateExpense(req, res, next) {
  const body = req.body || {};
  const errors = [];

  const categoryId = Number(body.categoryId);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    pushError(errors, "categoryId", "Valid category id is required");
  }

  const paidBy = Number(body.paidByEmployeeId);
  if (!Number.isInteger(paidBy) || paidBy <= 0) {
    pushError(errors, "paidByEmployeeId", "Valid paid-by employee id is required");
  }

  validatePositiveAmount(body, "amount", errors, { required: true });
  validateNonNegative(body, "gstSalesTax", errors);
  validateNonNegative(body, "remainingAmount", errors);
  validateNonNegative(body, "quantity", errors);

  if (body.expenseDate !== undefined && body.expenseDate !== null && body.expenseDate !== "") {
    if (!isValidDateOnly(body.expenseDate)) {
      pushError(errors, "expenseDate", "expenseDate must be YYYY-MM-DD");
    }
  }

  if (body.subcategoryId !== undefined && body.subcategoryId !== null && body.subcategoryId !== "") {
    const sub = Number(body.subcategoryId);
    if (!Number.isInteger(sub) || sub <= 0) {
      pushError(errors, "subcategoryId", "Valid subcategory id is required");
    }
  }

  if (body.vendorId !== undefined && body.vendorId !== null && body.vendorId !== "") {
    const v = Number(body.vendorId);
    if (!Number.isInteger(v) || v <= 0) {
      pushError(errors, "vendorId", "Valid vendor id is required");
    }
  }

  if (body.paymentMethodId !== undefined && body.paymentMethodId !== null && body.paymentMethodId !== "") {
    const pm = Number(body.paymentMethodId);
    if (!Number.isInteger(pm) || pm <= 0) {
      pushError(errors, "paymentMethodId", "Valid payment method id is required");
    }
  }

  if (body.propertyId !== undefined && body.propertyId !== null && body.propertyId !== "") {
    const p = Number(body.propertyId);
    if (!Number.isInteger(p) || p <= 0) {
      pushError(errors, "propertyId", "Valid property id is required");
    }
  }

  if (
    body.reimbursementStatus !== undefined &&
    body.reimbursementStatus !== null &&
    body.reimbursementStatus !== "" &&
    !REIMBURSEMENT_STATUSES.includes(String(body.reimbursementStatus).toLowerCase())
  ) {
    pushError(
      errors,
      "reimbursementStatus",
      `Must be one of: ${REIMBURSEMENT_STATUSES.join(", ")}`
    );
  }

  if (body.approvalStatus !== undefined && body.approvalStatus !== null && body.approvalStatus !== "") {
    pushError(errors, "approvalStatus", "Use PATCH /api/expenses/:id/approval to change approval status");
  }

  // Device/item purchases require quantity
  if (isPresent(body.deviceOrItemName)) {
    if (body.quantity === undefined || body.quantity === null || body.quantity === "") {
      pushError(errors, "quantity", "Quantity is required when a device/item is purchased");
    }
  }

  const amount = Number(body.amount);
  const remaining =
    body.remainingAmount === undefined || body.remainingAmount === null || body.remainingAmount === ""
      ? 0
      : Number(body.remainingAmount);
  if (!Number.isNaN(amount) && amount > 0 && !Number.isNaN(remaining) && remaining > amount) {
    pushError(errors, "remainingAmount", "Remaining amount cannot exceed expense amount");
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.categoryId = categoryId;
  req.body.paidByEmployeeId = paidBy;
  req.body.amount = amount;
  if (body.gstSalesTax !== undefined && body.gstSalesTax !== null && body.gstSalesTax !== "") {
    req.body.gstSalesTax = Number(body.gstSalesTax);
  }
  req.body.remainingAmount = remaining;
  if (body.quantity !== undefined && body.quantity !== null && body.quantity !== "") {
    req.body.quantity = Number(body.quantity);
  }
  if (body.subcategoryId !== undefined && body.subcategoryId !== null && body.subcategoryId !== "") {
    req.body.subcategoryId = Number(body.subcategoryId);
  }
  if (body.vendorId !== undefined && body.vendorId !== null && body.vendorId !== "") {
    req.body.vendorId = Number(body.vendorId);
  }
  if (body.paymentMethodId !== undefined && body.paymentMethodId !== null && body.paymentMethodId !== "") {
    req.body.paymentMethodId = Number(body.paymentMethodId);
  }
  if (body.propertyId !== undefined && body.propertyId !== null && body.propertyId !== "") {
    req.body.propertyId = Number(body.propertyId);
  }
  if (body.reimbursementStatus) {
    req.body.reimbursementStatus = String(body.reimbursementStatus).toLowerCase();
  }
  return next();
}

function validateUpdateExpense(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (body.approvalStatus !== undefined) {
    pushError(errors, "approvalStatus", "Use PATCH /api/expenses/:id/approval to change approval status");
  }

  if (body.amount !== undefined) validatePositiveAmount(body, "amount", errors);
  validateNonNegative(body, "gstSalesTax", errors);
  validateNonNegative(body, "remainingAmount", errors);
  validateNonNegative(body, "quantity", errors);

  if (body.expenseDate !== undefined && body.expenseDate !== null && body.expenseDate !== "") {
    if (!isValidDateOnly(body.expenseDate)) {
      pushError(errors, "expenseDate", "expenseDate must be YYYY-MM-DD");
    }
  }

  if (
    body.reimbursementStatus !== undefined &&
    body.reimbursementStatus !== null &&
    body.reimbursementStatus !== "" &&
    !REIMBURSEMENT_STATUSES.includes(String(body.reimbursementStatus).toLowerCase())
  ) {
    pushError(
      errors,
      "reimbursementStatus",
      `Must be one of: ${REIMBURSEMENT_STATUSES.join(", ")}`
    );
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  if (body.amount !== undefined) req.body.amount = Number(body.amount);
  if (body.gstSalesTax !== undefined && body.gstSalesTax !== null && body.gstSalesTax !== "") {
    req.body.gstSalesTax = Number(body.gstSalesTax);
  }
  if (body.remainingAmount !== undefined && body.remainingAmount !== null && body.remainingAmount !== "") {
    req.body.remainingAmount = Number(body.remainingAmount);
  }
  if (body.quantity !== undefined && body.quantity !== null && body.quantity !== "") {
    req.body.quantity = Number(body.quantity);
  }
  if (body.categoryId !== undefined) req.body.categoryId = Number(body.categoryId);
  if (body.subcategoryId !== undefined && body.subcategoryId !== null && body.subcategoryId !== "") {
    req.body.subcategoryId = Number(body.subcategoryId);
  }
  if (body.paidByEmployeeId !== undefined) {
    req.body.paidByEmployeeId = Number(body.paidByEmployeeId);
  }
  if (body.vendorId !== undefined && body.vendorId !== null && body.vendorId !== "") {
    req.body.vendorId = Number(body.vendorId);
  }
  if (body.paymentMethodId !== undefined && body.paymentMethodId !== null && body.paymentMethodId !== "") {
    req.body.paymentMethodId = Number(body.paymentMethodId);
  }
  if (body.propertyId !== undefined && body.propertyId !== null && body.propertyId !== "") {
    req.body.propertyId = Number(body.propertyId);
  }
  if (body.reimbursementStatus) {
    req.body.reimbursementStatus = String(body.reimbursementStatus).toLowerCase();
  }
  return next();
}

function validateApprovalChange(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const status = body.approvalStatus || body.status;

  if (!isPresent(status)) {
    pushError(errors, "approvalStatus", "Approval status is required");
  } else if (!APPROVAL_STATUSES.includes(String(status).toLowerCase())) {
    pushError(errors, "approvalStatus", `Must be one of: ${APPROVAL_STATUSES.join(", ")}`);
  } else if (String(status).toLowerCase() === "requested") {
    pushError(errors, "approvalStatus", "Cannot set approval status back to requested");
  }

  if (String(status || "").toLowerCase() === "rejected" && !isPresent(body.rejectionReason)) {
    pushError(errors, "rejectionReason", "Rejection reason is required when rejecting");
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.approvalStatus = String(status).toLowerCase();
  return next();
}

function validateIdParam(paramName = "id") {
  return (req, res, next) => {
    const id = Number(req.params[paramName]);
    if (!Number.isInteger(id) || id <= 0) {
      return next(new ApiError(400, `Invalid ${paramName}`));
    }
    req.params[paramName] = id;
    return next();
  };
}

module.exports = {
  validateCreateExpense,
  validateUpdateExpense,
  validateApprovalChange,
  validateIdParam,
};
