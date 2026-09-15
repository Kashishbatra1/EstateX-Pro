/**
 * Validation for Commission & Brokerage endpoints.
 */
const ApiError = require("../utils/ApiError");
const { PAYMENT_STATUSES } = require("../utils/commissionMapper");

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

function optionalNonNegative(body, field, errors) {
  if (!isPresent(body[field])) return null;
  const n = Number(body[field]);
  if (Number.isNaN(n) || n < 0) {
    pushError(errors, field, `${field} must be a non-negative number`);
    return null;
  }
  return n;
}

function validateCreateCommission(req, res, next) {
  const body = req.body || {};
  const errors = [];

  const propertyId = Number(body.propertyId);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    pushError(errors, "propertyId", "Valid property id is required");
  }

  const bookingId = optionalPositiveInt(body, "bookingId", errors);
  const assignedAgentId = optionalPositiveInt(body, "assignedAgentId", errors);

  let commissionPercentage = null;
  if (isPresent(body.commissionPercentage)) {
    commissionPercentage = Number(body.commissionPercentage);
    if (
      Number.isNaN(commissionPercentage) ||
      commissionPercentage < 0 ||
      commissionPercentage > 100
    ) {
      pushError(
        errors,
        "commissionPercentage",
        "Commission percentage must be between 0 and 100"
      );
    }
  }

  const brokerageFromBuyer = optionalNonNegative(
    body,
    "brokerageFromBuyer",
    errors
  );
  const brokerageFromSeller = optionalNonNegative(
    body,
    "brokerageFromSeller",
    errors
  );

  const isManualOverride = Boolean(body.isManualOverride);
  let finalAmount = null;
  if (isManualOverride) {
    if (!isPresent(body.finalAmount)) {
      pushError(
        errors,
        "finalAmount",
        "finalAmount is required for manual override"
      );
    } else {
      finalAmount = Number(body.finalAmount);
      if (Number.isNaN(finalAmount) || finalAmount < 0) {
        pushError(errors, "finalAmount", "finalAmount must be non-negative");
      }
    }
    if (!isPresent(body.overrideReason)) {
      pushError(
        errors,
        "overrideReason",
        "overrideReason is required for manual override"
      );
    }
  }

  let paymentStatus = "unpaid";
  if (isPresent(body.paymentStatus)) {
    paymentStatus = String(body.paymentStatus).toLowerCase();
    if (!PAYMENT_STATUSES.includes(paymentStatus)) {
      pushError(
        errors,
        "paymentStatus",
        `Must be one of: ${PAYMENT_STATUSES.join(", ")}`
      );
    }
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.propertyId = propertyId;
  req.body.bookingId = bookingId;
  req.body.assignedAgentId = assignedAgentId;
  req.body.commissionPercentage = commissionPercentage;
  req.body.brokerageFromBuyer =
    brokerageFromBuyer === null ? 0 : brokerageFromBuyer;
  req.body.brokerageFromSeller =
    brokerageFromSeller === null ? 0 : brokerageFromSeller;
  req.body.isManualOverride = isManualOverride;
  req.body.finalAmount = finalAmount;
  req.body.overrideReason = isPresent(body.overrideReason)
    ? String(body.overrideReason).trim()
    : null;
  req.body.paymentStatus = paymentStatus;
  req.body.referralSource = isPresent(body.referralSource)
    ? String(body.referralSource).trim()
    : null;
  return next();
}

function validateUpdateCommission(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const has = (field) => Object.prototype.hasOwnProperty.call(body, field);

  if (has("propertyId")) {
    pushError(errors, "propertyId", "propertyId cannot be changed");
  }
  if (has("bookingId")) {
    pushError(errors, "bookingId", "bookingId cannot be changed");
  }
  if (has("calculatedAmount")) {
    pushError(
      errors,
      "calculatedAmount",
      "calculatedAmount is computed by the server"
    );
  }

  if (has("commissionPercentage") && isPresent(body.commissionPercentage)) {
    const p = Number(body.commissionPercentage);
    if (Number.isNaN(p) || p < 0 || p > 100) {
      pushError(
        errors,
        "commissionPercentage",
        "Commission percentage must be between 0 and 100"
      );
    } else {
      body.commissionPercentage = p;
    }
  }

  if (has("brokerageFromBuyer")) {
    const n = optionalNonNegative(body, "brokerageFromBuyer", errors);
    if (n !== null) body.brokerageFromBuyer = n;
    else if (!isPresent(body.brokerageFromBuyer)) body.brokerageFromBuyer = 0;
  }

  if (has("brokerageFromSeller")) {
    const n = optionalNonNegative(body, "brokerageFromSeller", errors);
    if (n !== null) body.brokerageFromSeller = n;
    else if (!isPresent(body.brokerageFromSeller)) body.brokerageFromSeller = 0;
  }

  if (has("assignedAgentId") && isPresent(body.assignedAgentId)) {
    const n = optionalPositiveInt(body, "assignedAgentId", errors);
    if (n !== null) body.assignedAgentId = n;
  } else if (has("assignedAgentId") && !isPresent(body.assignedAgentId)) {
    body.assignedAgentId = null;
  }

  if (has("paymentStatus") && isPresent(body.paymentStatus)) {
    const status = String(body.paymentStatus).toLowerCase();
    if (!PAYMENT_STATUSES.includes(status)) {
      pushError(
        errors,
        "paymentStatus",
        `Must be one of: ${PAYMENT_STATUSES.join(", ")}`
      );
    } else {
      body.paymentStatus = status;
    }
  }

  if (has("isManualOverride")) {
    body.isManualOverride = Boolean(body.isManualOverride);
    if (body.isManualOverride) {
      if (!isPresent(body.finalAmount) && !has("finalAmount")) {
        // allow if existing final kept — service validates
      }
      if (has("finalAmount") && isPresent(body.finalAmount)) {
        const n = Number(body.finalAmount);
        if (Number.isNaN(n) || n < 0) {
          pushError(errors, "finalAmount", "finalAmount must be non-negative");
        } else {
          body.finalAmount = n;
        }
      }
      if (has("overrideReason") && !isPresent(body.overrideReason)) {
        pushError(
          errors,
          "overrideReason",
          "overrideReason is required for manual override"
        );
      }
    }
  } else if (has("finalAmount")) {
    pushError(
      errors,
      "finalAmount",
      "Set isManualOverride=true to override finalAmount"
    );
  }

  if (has("referralSource") && isPresent(body.referralSource)) {
    body.referralSource = String(body.referralSource).trim();
  } else if (has("referralSource")) {
    body.referralSource = null;
  }

  if (has("overrideReason") && isPresent(body.overrideReason)) {
    body.overrideReason = String(body.overrideReason).trim();
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body = body;
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
  validateCreateCommission,
  validateUpdateCommission,
  validateIdParam,
};
