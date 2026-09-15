/**
 * Validation for Bank Accounts and Payment Methods.
 */
const ApiError = require("../utils/ApiError");

function pushError(errors, field, message) {
  errors.push({ field, message });
}

function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validateCreateBankAccount(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (!isPresent(body.bankName)) {
    pushError(errors, "bankName", "Bank name is required");
  }
  if (!isPresent(body.accountHolderName)) {
    pushError(errors, "accountHolderName", "Account holder name is required");
  }
  if (!isPresent(body.accountNumber)) {
    pushError(errors, "accountNumber", "Account number is required");
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.bankName = String(body.bankName).trim();
  req.body.accountHolderName = String(body.accountHolderName).trim();
  req.body.accountNumber = String(body.accountNumber).trim();
  if (body.isActive !== undefined) req.body.isActive = Boolean(body.isActive);
  return next();
}

function validateUpdateBankAccount(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (body.bankName !== undefined && !isPresent(body.bankName)) {
    pushError(errors, "bankName", "Bank name cannot be empty");
  }
  if (body.accountHolderName !== undefined && !isPresent(body.accountHolderName)) {
    pushError(errors, "accountHolderName", "Account holder name cannot be empty");
  }
  if (body.accountNumber !== undefined && !isPresent(body.accountNumber)) {
    pushError(errors, "accountNumber", "Account number cannot be empty");
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  if (body.bankName !== undefined) req.body.bankName = String(body.bankName).trim();
  if (body.accountHolderName !== undefined) {
    req.body.accountHolderName = String(body.accountHolderName).trim();
  }
  if (body.accountNumber !== undefined) {
    req.body.accountNumber = String(body.accountNumber).trim();
  }
  if (body.isActive !== undefined) req.body.isActive = Boolean(body.isActive);
  return next();
}

function validateCreatePaymentMethod(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (!isPresent(body.methodName)) {
    pushError(errors, "methodName", "Payment method name is required");
  } else if (String(body.methodName).trim().length > 50) {
    pushError(errors, "methodName", "Payment method name must be at most 50 characters");
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.methodName = String(body.methodName).trim();
  if (body.isActive !== undefined) req.body.isActive = Boolean(body.isActive);
  return next();
}

function validateUpdatePaymentMethod(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (body.methodName !== undefined && !isPresent(body.methodName)) {
    pushError(errors, "methodName", "Payment method name cannot be empty");
  }
  if (body.isActive === undefined && body.methodName === undefined) {
    pushError(errors, "body", "Provide methodName and/or isActive to update");
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  if (body.methodName !== undefined) {
    req.body.methodName = String(body.methodName).trim();
  }
  if (body.isActive !== undefined) req.body.isActive = Boolean(body.isActive);
  return next();
}

function validateLinkBankAccount(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (body.bankAccountId === undefined || body.bankAccountId === null || body.bankAccountId === "") {
    pushError(errors, "bankAccountId", "Bank account id is required");
  } else {
    const id = Number(body.bankAccountId);
    if (!Number.isInteger(id) || id <= 0) {
      pushError(errors, "bankAccountId", "Bank account id must be a positive integer");
    }
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.bankAccountId = Number(body.bankAccountId);
  req.body.isPrimary = Boolean(body.isPrimary);
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
  validateCreateBankAccount,
  validateUpdateBankAccount,
  validateCreatePaymentMethod,
  validateUpdatePaymentMethod,
  validateLinkBankAccount,
  validateIdParam,
};
