/**
 * Validation for Resale & Transfer endpoints.
 */
const ApiError = require("../utils/ApiError");
const { TRANSFER_TYPES } = require("../utils/transferMapper");

function pushError(errors, field, message) {
  errors.push({ field, message });
}

function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function optionalPositiveInt(body, field, errors) {
  if (!isPresent(body[field])) return null;
  const n = Number(body[field]);
  if (!Number.isInteger(n) || n <= 0) {
    pushError(errors, field, `Valid ${field} is required`);
    return null;
  }
  return n;
}

function optionalNonNegative(body, field, errors, { defaultZero = false } = {}) {
  if (!isPresent(body[field])) {
    return defaultZero ? 0 : null;
  }
  const n = Number(body[field]);
  if (Number.isNaN(n) || n < 0) {
    pushError(errors, field, `${field} must be a non-negative number`);
    return null;
  }
  return n;
}

function optionalDate(body, field, errors) {
  if (!isPresent(body[field])) return null;
  const raw = String(body[field]).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    pushError(errors, field, `${field} must be YYYY-MM-DD`);
    return null;
  }
  return raw;
}

function optionalString(body, field, maxLen) {
  if (!isPresent(body[field])) return null;
  const s = String(body[field]).trim();
  if (maxLen && s.length > maxLen) return s.slice(0, maxLen);
  return s;
}

function validateCreateTransfer(req, res, next) {
  const body = req.body || {};
  const errors = [];

  const propertyId = Number(body.propertyId);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    pushError(errors, "propertyId", "Valid property id is required");
  }

  let transferType = null;
  if (!isPresent(body.transferType)) {
    pushError(errors, "transferType", "transferType is required");
  } else {
    transferType = String(body.transferType).toLowerCase();
    if (!TRANSFER_TYPES.includes(transferType)) {
      pushError(
        errors,
        "transferType",
        `Must be one of: ${TRANSFER_TYPES.join(", ")}`
      );
    }
  }

  const fromOwnerId = optionalPositiveInt(body, "fromOwnerId", errors);
  const toOwnerId = optionalPositiveInt(body, "toOwnerId", errors);
  const fromClientId = optionalPositiveInt(body, "fromClientId", errors);
  const toClientId = optionalPositiveInt(body, "toClientId", errors);

  const transferCharges = optionalNonNegative(body, "transferCharges", errors, {
    defaultZero: true,
  });
  const leaseCharges = optionalNonNegative(body, "leaseCharges", errors, {
    defaultZero: true,
  });
  const transferTax = optionalNonNegative(body, "transferTax", errors, {
    defaultZero: true,
  });
  const stampDuty = optionalNonNegative(body, "stampDuty", errors, {
    defaultZero: true,
  });

  const transferDate = optionalDate(body, "transferDate", errors);

  let nocForTransfer = false;
  if (body.nocForTransfer !== undefined && body.nocForTransfer !== null) {
    if (typeof body.nocForTransfer === "boolean") {
      nocForTransfer = body.nocForTransfer;
    } else if (body.nocForTransfer === "true" || body.nocForTransfer === "false") {
      nocForTransfer = body.nocForTransfer === "true";
    } else {
      pushError(errors, "nocForTransfer", "nocForTransfer must be a boolean");
    }
  }

  const nocStatus = optionalString(body, "nocStatus", 50);
  const nocDocumentPath = optionalString(body, "nocDocumentPath", 500);
  const notes = optionalString(body, "notes", null);

  if (isPresent(body.previousOwnerSnapshot)) {
    pushError(
      errors,
      "previousOwnerSnapshot",
      "previousOwnerSnapshot is set by the server"
    );
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body = {
    propertyId,
    transferType,
    fromOwnerId,
    toOwnerId,
    fromClientId,
    toClientId,
    transferCharges: transferCharges ?? 0,
    leaseCharges: leaseCharges ?? 0,
    transferTax: transferTax ?? 0,
    stampDuty: stampDuty ?? 0,
    transferDate,
    nocForTransfer,
    nocStatus,
    nocDocumentPath,
    notes,
  };
  return next();
}

function validateUpdateTransfer(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const has = (field) => Object.prototype.hasOwnProperty.call(body, field);
  const nextBody = {};

  if (has("propertyId")) {
    pushError(errors, "propertyId", "propertyId cannot be changed");
  }
  if (has("previousOwnerSnapshot")) {
    pushError(
      errors,
      "previousOwnerSnapshot",
      "previousOwnerSnapshot cannot be changed"
    );
  }
  if (has("createdBy") || has("createdAt") || has("deletedAt") || has("deletedBy")) {
    pushError(errors, "meta", "Audit/soft-delete metadata cannot be updated");
  }

  if (has("transferType") && isPresent(body.transferType)) {
    const t = String(body.transferType).toLowerCase();
    if (!TRANSFER_TYPES.includes(t)) {
      pushError(
        errors,
        "transferType",
        `Must be one of: ${TRANSFER_TYPES.join(", ")}`
      );
    } else {
      nextBody.transferType = t;
    }
  }

  if (has("fromOwnerId")) {
    nextBody.fromOwnerId = isPresent(body.fromOwnerId)
      ? optionalPositiveInt(body, "fromOwnerId", errors)
      : null;
  }
  if (has("toOwnerId")) {
    nextBody.toOwnerId = isPresent(body.toOwnerId)
      ? optionalPositiveInt(body, "toOwnerId", errors)
      : null;
  }
  if (has("fromClientId")) {
    nextBody.fromClientId = isPresent(body.fromClientId)
      ? optionalPositiveInt(body, "fromClientId", errors)
      : null;
  }
  if (has("toClientId")) {
    nextBody.toClientId = isPresent(body.toClientId)
      ? optionalPositiveInt(body, "toClientId", errors)
      : null;
  }

  if (has("transferCharges")) {
    const n = optionalNonNegative(body, "transferCharges", errors, {
      defaultZero: true,
    });
    if (n !== null) nextBody.transferCharges = n;
  }
  if (has("leaseCharges")) {
    const n = optionalNonNegative(body, "leaseCharges", errors, {
      defaultZero: true,
    });
    if (n !== null) nextBody.leaseCharges = n;
  }
  if (has("transferTax")) {
    const n = optionalNonNegative(body, "transferTax", errors, {
      defaultZero: true,
    });
    if (n !== null) nextBody.transferTax = n;
  }
  if (has("stampDuty")) {
    const n = optionalNonNegative(body, "stampDuty", errors, {
      defaultZero: true,
    });
    if (n !== null) nextBody.stampDuty = n;
  }

  if (has("transferDate")) {
    if (!isPresent(body.transferDate)) {
      pushError(errors, "transferDate", "transferDate cannot be empty");
    } else {
      const d = optionalDate(body, "transferDate", errors);
      if (d) nextBody.transferDate = d;
    }
  }

  if (has("nocForTransfer")) {
    if (typeof body.nocForTransfer === "boolean") {
      nextBody.nocForTransfer = body.nocForTransfer;
    } else if (body.nocForTransfer === "true" || body.nocForTransfer === "false") {
      nextBody.nocForTransfer = body.nocForTransfer === "true";
    } else {
      pushError(errors, "nocForTransfer", "nocForTransfer must be a boolean");
    }
  }

  if (has("nocStatus")) {
    nextBody.nocStatus = isPresent(body.nocStatus)
      ? optionalString(body, "nocStatus", 50)
      : null;
  }
  if (has("nocDocumentPath")) {
    nextBody.nocDocumentPath = isPresent(body.nocDocumentPath)
      ? optionalString(body, "nocDocumentPath", 500)
      : null;
  }
  if (has("notes")) {
    nextBody.notes = isPresent(body.notes) ? optionalString(body, "notes", null) : null;
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body = nextBody;
  return next();
}

function validateIdParam(paramName = "id") {
  return (req, res, next) => {
    const id = Number(req.params[paramName]);
    if (!Number.isInteger(id) || id <= 0) {
      return next(
        new ApiError(400, "Validation failed", [
          { field: paramName, message: `Valid ${paramName} is required` },
        ])
      );
    }
    req.params[paramName] = id;
    return next();
  };
}

module.exports = {
  validateCreateTransfer,
  validateUpdateTransfer,
  validateIdParam,
};
