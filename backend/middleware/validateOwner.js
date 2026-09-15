/**
 * Request validation for Owners Management endpoints.
 */
const ApiError = require("../utils/ApiError");
const { VERIFICATION_VALUES } = require("../utils/ownerMapper");

function pushError(errors, field, message) {
  errors.push({ field, message });
}

function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validateCreateOwner(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (!isPresent(body.ownerName)) {
    pushError(errors, "ownerName", "Owner name is required");
  } else if (String(body.ownerName).trim().length > 150) {
    pushError(errors, "ownerName", "Owner name must be at most 150 characters");
  }

  if (body.email !== undefined && body.email !== null && String(body.email).trim() !== "") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) {
      pushError(errors, "email", "Email format is invalid");
    }
  }

  if (body.cnic !== undefined && body.cnic !== null && String(body.cnic).trim() !== "") {
    if (String(body.cnic).trim().length > 20) {
      pushError(errors, "cnic", "CNIC must be at most 20 characters");
    }
  }

  if (body.verificationStatus !== undefined) {
    pushError(
      errors,
      "verificationStatus",
      "Use PATCH /api/owners/:id/verification to change verification status"
    );
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.ownerName = String(body.ownerName).trim();
  if (body.email) req.body.email = String(body.email).trim().toLowerCase();
  if (body.cnic !== undefined && body.cnic !== null && String(body.cnic).trim() === "") {
    req.body.cnic = null;
  }
  return next();
}

function validateUpdateOwner(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (body.ownerName !== undefined) {
    if (!isPresent(body.ownerName)) {
      pushError(errors, "ownerName", "Owner name cannot be empty");
    } else if (String(body.ownerName).trim().length > 150) {
      pushError(errors, "ownerName", "Owner name must be at most 150 characters");
    }
  }

  if (body.email !== undefined && body.email !== null && String(body.email).trim() !== "") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) {
      pushError(errors, "email", "Email format is invalid");
    }
  }

  if (body.verificationStatus !== undefined) {
    pushError(
      errors,
      "verificationStatus",
      "Use PATCH /api/owners/:id/verification to change verification status"
    );
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  if (body.ownerName !== undefined) {
    req.body.ownerName = String(body.ownerName).trim();
  }
  if (body.email) req.body.email = String(body.email).trim().toLowerCase();
  if (body.cnic !== undefined && body.cnic !== null && String(body.cnic).trim() === "") {
    req.body.cnic = null;
  }
  return next();
}

function validateVerification(req, res, next) {
  const status = req.body && req.body.verificationStatus;
  const errors = [];

  if (!isPresent(status)) {
    pushError(errors, "verificationStatus", "Verification status is required");
  } else if (!VERIFICATION_VALUES.includes(String(status).toLowerCase())) {
    pushError(
      errors,
      "verificationStatus",
      `Verification status must be one of: ${VERIFICATION_VALUES.join(", ")}`
    );
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.verificationStatus = String(status).toLowerCase();
  return next();
}

function validateLinkOwner(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (body.ownerId === undefined || body.ownerId === null || body.ownerId === "") {
    pushError(errors, "ownerId", "Owner id is required");
  } else {
    const ownerId = Number(body.ownerId);
    if (!Number.isInteger(ownerId) || ownerId <= 0) {
      pushError(errors, "ownerId", "Owner id must be a positive integer");
    }
  }

  if (body.sharePercentage === undefined || body.sharePercentage === null || body.sharePercentage === "") {
    pushError(errors, "sharePercentage", "Share percentage is required");
  } else {
    const share = Number(body.sharePercentage);
    if (Number.isNaN(share) || share <= 0 || share > 100) {
      pushError(errors, "sharePercentage", "Share percentage must be greater than 0 and at most 100");
    }
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.ownerId = Number(body.ownerId);
  req.body.sharePercentage = Number(body.sharePercentage);
  req.body.isPrimary = Boolean(body.isPrimary);
  if (body.ownershipDocumentType !== undefined) {
    req.body.ownershipDocumentType =
      body.ownershipDocumentType === "" || body.ownershipDocumentType === null
        ? null
        : String(body.ownershipDocumentType).trim();
  }
  return next();
}

function validateShareUpdate(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (body.sharePercentage === undefined || body.sharePercentage === null || body.sharePercentage === "") {
    pushError(errors, "sharePercentage", "Share percentage is required");
  } else {
    const share = Number(body.sharePercentage);
    if (Number.isNaN(share) || share <= 0 || share > 100) {
      pushError(errors, "sharePercentage", "Share percentage must be greater than 0 and at most 100");
    }
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.sharePercentage = Number(body.sharePercentage);
  if (body.isPrimary !== undefined) {
    req.body.isPrimary = Boolean(body.isPrimary);
  }
  if (body.ownershipDocumentType !== undefined) {
    req.body.ownershipDocumentType =
      body.ownershipDocumentType === "" || body.ownershipDocumentType === null
        ? null
        : String(body.ownershipDocumentType).trim();
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
  validateCreateOwner,
  validateUpdateOwner,
  validateVerification,
  validateLinkOwner,
  validateShareUpdate,
  validateIdParam,
};
