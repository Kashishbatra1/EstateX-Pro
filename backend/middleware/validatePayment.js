/**
 * Validation for Payments Management endpoints.
 */
const ApiError = require("../utils/ApiError");

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

function validateCreatePayment(req, res, next) {
  const body = req.body || {};
  const errors = [];

  const bookingId = Number(body.bookingId);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    pushError(errors, "bookingId", "Valid booking id is required");
  }

  const amount = Number(body.amount);
  if (body.amount === undefined || body.amount === null || body.amount === "") {
    pushError(errors, "amount", "Payment amount is required");
  } else if (Number.isNaN(amount) || amount <= 0) {
    pushError(errors, "amount", "Payment amount must be a positive number");
  }

  if (body.paymentMethodId !== undefined && body.paymentMethodId !== null && body.paymentMethodId !== "") {
    const pm = Number(body.paymentMethodId);
    if (!Number.isInteger(pm) || pm <= 0) {
      pushError(errors, "paymentMethodId", "Valid payment method id is required");
    }
  } else {
    pushError(errors, "paymentMethodId", "Payment method is required");
  }

  if (body.paymentDate !== undefined && body.paymentDate !== null && body.paymentDate !== "") {
    if (!isValidDateOnly(body.paymentDate)) {
      pushError(errors, "paymentDate", "paymentDate must be YYYY-MM-DD");
    }
  }

  if (body.installmentId !== undefined && body.installmentId !== null && body.installmentId !== "") {
    const inst = Number(body.installmentId);
    if (!Number.isInteger(inst) || inst <= 0) {
      pushError(errors, "installmentId", "Valid installment id is required");
    }
  }

  if (body.bankAccountId !== undefined && body.bankAccountId !== null && body.bankAccountId !== "") {
    const bank = Number(body.bankAccountId);
    if (!Number.isInteger(bank) || bank <= 0) {
      pushError(errors, "bankAccountId", "Valid bank account id is required");
    }
  }

  if (body.receivedBy !== undefined && body.receivedBy !== null && body.receivedBy !== "") {
    const emp = Number(body.receivedBy);
    if (!Number.isInteger(emp) || emp <= 0) {
      pushError(errors, "receivedBy", "Valid employee id is required");
    }
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.bookingId = bookingId;
  req.body.amount = amount;
  req.body.paymentMethodId = Number(body.paymentMethodId);
  if (body.installmentId !== undefined && body.installmentId !== null && body.installmentId !== "") {
    req.body.installmentId = Number(body.installmentId);
  }
  if (body.bankAccountId !== undefined && body.bankAccountId !== null && body.bankAccountId !== "") {
    req.body.bankAccountId = Number(body.bankAccountId);
  }
  if (body.receivedBy !== undefined && body.receivedBy !== null && body.receivedBy !== "") {
    req.body.receivedBy = Number(body.receivedBy);
  }
  return next();
}

function validateUpdatePayment(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (body.bookingId !== undefined || body.installmentId !== undefined) {
    pushError(
      errors,
      "bookingId/installmentId",
      "Booking and installment cannot be reassigned; reverse and create a new payment"
    );
  }

  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      pushError(errors, "amount", "Payment amount must be a positive number");
    }
  }

  if (body.paymentDate !== undefined && body.paymentDate !== null && body.paymentDate !== "") {
    if (!isValidDateOnly(body.paymentDate)) {
      pushError(errors, "paymentDate", "paymentDate must be YYYY-MM-DD");
    }
  }

  if (body.paymentMethodId !== undefined && body.paymentMethodId !== null && body.paymentMethodId !== "") {
    const pm = Number(body.paymentMethodId);
    if (!Number.isInteger(pm) || pm <= 0) {
      pushError(errors, "paymentMethodId", "Valid payment method id is required");
    }
  }

  if (body.bankAccountId !== undefined && body.bankAccountId !== null && body.bankAccountId !== "") {
    const bank = Number(body.bankAccountId);
    if (!Number.isInteger(bank) || bank <= 0) {
      pushError(errors, "bankAccountId", "Valid bank account id is required");
    }
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  if (body.amount !== undefined) req.body.amount = Number(body.amount);
  if (body.paymentMethodId !== undefined && body.paymentMethodId !== null && body.paymentMethodId !== "") {
    req.body.paymentMethodId = Number(body.paymentMethodId);
  }
  if (body.bankAccountId !== undefined && body.bankAccountId !== null && body.bankAccountId !== "") {
    req.body.bankAccountId = Number(body.bankAccountId);
  }
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
  validateCreatePayment,
  validateUpdatePayment,
  validateIdParam,
};
