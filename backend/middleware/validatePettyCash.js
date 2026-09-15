/**
 * Validation for Petty Cash endpoints.
 */
const ApiError = require("../utils/ApiError");
const { TXN_TYPES, ACCOUNT_WRITABLE } = require("../utils/pettyCashMapper");

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

function coerceBool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
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

function validateAccountFields(body, errors, { partial = false } = {}) {
  if (!partial || body.accountName !== undefined) {
    if (!isPresent(body.accountName)) {
      if (!partial) pushError(errors, "accountName", "Account name is required");
      else pushError(errors, "accountName", "Account name cannot be empty");
    } else if (String(body.accountName).trim().length > 150) {
      pushError(errors, "accountName", "Account name must be at most 150 characters");
    } else {
      body.accountName = String(body.accountName).trim();
    }
  }

  if (
    !partial ||
    (body.custodianEmployeeId !== undefined &&
      body.custodianEmployeeId !== null &&
      body.custodianEmployeeId !== "")
  ) {
    if (
      body.custodianEmployeeId === undefined ||
      body.custodianEmployeeId === null ||
      body.custodianEmployeeId === ""
    ) {
      if (!partial) {
        pushError(errors, "custodianEmployeeId", "Custodian employee is required");
      }
    } else {
      const id = Number(body.custodianEmployeeId);
      if (!Number.isInteger(id) || id <= 0) {
        pushError(errors, "custodianEmployeeId", "Valid employee id is required");
      } else {
        body.custodianEmployeeId = id;
      }
    }
  }

  if (
    body.floatAmount !== undefined &&
    body.floatAmount !== null &&
    body.floatAmount !== ""
  ) {
    const n = Number(body.floatAmount);
    if (Number.isNaN(n) || n < 0) {
      pushError(errors, "floatAmount", "Float amount must be a non-negative number");
    } else {
      body.floatAmount = n;
    }
  } else if (!partial) {
    body.floatAmount = 0;
  }

  if (body.isActive !== undefined) {
    body.isActive = coerceBool(body.isActive);
  }

  if (body.notes !== undefined && body.notes !== null) {
    body.notes = String(body.notes);
  }
}

function validateCreateAccount(req, res, next) {
  const body = req.body || {};
  const errors = [];
  validateAccountFields(body, errors, { partial: false });
  if (errors.length) return next(new ApiError(400, "Validation failed", errors));
  req.body = body;
  return next();
}

function validateUpdateAccount(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const keys = Object.keys(ACCOUNT_WRITABLE);
  if (!keys.some((k) => body[k] !== undefined)) {
    return next(
      new ApiError(400, "Validation failed", [
        { field: "body", message: "No updatable fields provided" },
      ])
    );
  }
  validateAccountFields(body, errors, { partial: true });
  if (errors.length) return next(new ApiError(400, "Validation failed", errors));
  req.body = body;
  return next();
}

function validateTxn(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (!isPresent(body.txnType) || !TXN_TYPES.includes(String(body.txnType))) {
    pushError(errors, "txnType", `txnType must be one of: ${TXN_TYPES.join(", ")}`);
  } else {
    body.txnType = String(body.txnType);
  }

  const amt = Number(body.amount);
  if (body.amount === undefined || body.amount === null || body.amount === "") {
    pushError(errors, "amount", "Amount is required");
  } else if (Number.isNaN(amt) || amt <= 0) {
    pushError(errors, "amount", "Amount must be greater than 0");
  } else {
    body.amount = amt;
  }

  if (body.expenseId !== undefined && body.expenseId !== null && body.expenseId !== "") {
    const eid = Number(body.expenseId);
    if (!Number.isInteger(eid) || eid <= 0) {
      pushError(errors, "expenseId", "Valid expense id is required");
    } else {
      body.expenseId = eid;
    }
  } else {
    body.expenseId = null;
  }

  if (body.performedBy !== undefined && body.performedBy !== null && body.performedBy !== "") {
    const pid = Number(body.performedBy);
    if (!Number.isInteger(pid) || pid <= 0) {
      pushError(errors, "performedBy", "Valid employee id is required");
    } else {
      body.performedBy = pid;
    }
  } else {
    body.performedBy = null;
  }

  if (body.txnDate !== undefined && body.txnDate !== null && body.txnDate !== "") {
    if (!isValidDateOnly(body.txnDate)) {
      pushError(errors, "txnDate", "txnDate must be YYYY-MM-DD");
    } else {
      body.txnDate = String(body.txnDate).slice(0, 10);
    }
  }

  if (body.description !== undefined && body.description !== null) {
    body.description = String(body.description);
  }

  if (errors.length) return next(new ApiError(400, "Validation failed", errors));
  req.body = body;
  return next();
}

function validateReconciliation(req, res, next) {
  const body = req.body || {};
  const errors = [];

  const counted = Number(body.countedBalance);
  if (
    body.countedBalance === undefined ||
    body.countedBalance === null ||
    body.countedBalance === ""
  ) {
    pushError(errors, "countedBalance", "Counted balance is required");
  } else if (Number.isNaN(counted) || counted < 0) {
    pushError(errors, "countedBalance", "Counted balance must be a non-negative number");
  } else {
    body.countedBalance = counted;
  }

  if (
    body.reconciledOn !== undefined &&
    body.reconciledOn !== null &&
    body.reconciledOn !== ""
  ) {
    if (!isValidDateOnly(body.reconciledOn)) {
      pushError(errors, "reconciledOn", "reconciledOn must be YYYY-MM-DD");
    } else {
      body.reconciledOn = String(body.reconciledOn).slice(0, 10);
    }
  }

  if (
    body.reconciledBy !== undefined &&
    body.reconciledBy !== null &&
    body.reconciledBy !== ""
  ) {
    const id = Number(body.reconciledBy);
    if (!Number.isInteger(id) || id <= 0) {
      pushError(errors, "reconciledBy", "Valid employee id is required");
    } else {
      body.reconciledBy = id;
    }
  } else {
    body.reconciledBy = null;
  }

  if (body.notes !== undefined && body.notes !== null) {
    body.notes = String(body.notes);
  }

  if (errors.length) return next(new ApiError(400, "Validation failed", errors));
  req.body = body;
  return next();
}

module.exports = {
  validateIdParam,
  validateCreateAccount,
  validateUpdateAccount,
  validateTxn,
  validateReconciliation,
};
