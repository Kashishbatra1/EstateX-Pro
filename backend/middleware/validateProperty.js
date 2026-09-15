/**
 * Request validation for Property Management endpoints.
 */
const ApiError = require("../utils/ApiError");
const {
  STATUS_VALUES,
  PURPOSE_VALUES,
  CATEGORY_VALUES,
} = require("../utils/propertyMapper");

function pushError(errors, field, message) {
  errors.push({ field, message });
}

function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validateFeatures(body, errors) {
  if (body.features === undefined || body.features === null) return;
  if (typeof body.features !== "object" || Array.isArray(body.features)) {
    pushError(errors, "features", "Features must be an object");
    return;
  }
  const f = body.features;
  if (
    f.parkingCapacity !== undefined &&
    f.parkingCapacity !== null &&
    f.parkingCapacity !== ""
  ) {
    const num = Number(f.parkingCapacity);
    if (Number.isNaN(num) || num < 0 || !Number.isInteger(num)) {
      pushError(
        errors,
        "features.parkingCapacity",
        "Parking capacity must be a non-negative integer"
      );
    }
  }
  if (f.waterSupply !== undefined && f.waterSupply !== null) {
    if (String(f.waterSupply).trim().length > 100) {
      pushError(
        errors,
        "features.waterSupply",
        "Water supply must be at most 100 characters"
      );
    }
  }
}

function validateCreateProperty(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (!isPresent(body.title)) {
    pushError(errors, "title", "Title is required");
  } else if (String(body.title).trim().length > 200) {
    pushError(errors, "title", "Title must be at most 200 characters");
  }

  if (!isPresent(body.purpose)) {
    pushError(errors, "purpose", "Purpose is required");
  } else if (!PURPOSE_VALUES.includes(String(body.purpose).toLowerCase())) {
    pushError(errors, "purpose", `Purpose must be one of: ${PURPOSE_VALUES.join(", ")}`);
  }

  if (!isPresent(body.category)) {
    pushError(errors, "category", "Category is required");
  } else if (!CATEGORY_VALUES.includes(String(body.category).toLowerCase())) {
    pushError(
      errors,
      "category",
      `Category must be one of: ${CATEGORY_VALUES.join(", ")}`
    );
  }

  if (body.status !== undefined && body.status !== null) {
    const status = String(body.status).toLowerCase();
    if (!STATUS_VALUES.includes(status)) {
      pushError(errors, "status", `Status must be one of: ${STATUS_VALUES.join(", ")}`);
    } else if (status !== "draft") {
      pushError(
        errors,
        "status",
        "New properties must be created as draft; use the status endpoint to list"
      );
    }
  }

  if (String(body.purpose || "").toLowerCase() === "rent") {
    if (body.monthlyRent === undefined || body.monthlyRent === null) {
      pushError(errors, "monthlyRent", "Monthly rent is required for rental properties");
    }
    if (body.advanceRentMonths === undefined || body.advanceRentMonths === null) {
      pushError(
        errors,
        "advanceRentMonths",
        "Advance rent months is required for rental properties"
      );
    }
    if (body.securityDeposit === undefined || body.securityDeposit === null) {
      pushError(
        errors,
        "securityDeposit",
        "Security deposit is required for rental properties"
      );
    }
  }

  validateNumericFields(body, errors);
  validateFeatures(body, errors);

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.purpose = String(body.purpose).toLowerCase();
  req.body.category = String(body.category).toLowerCase();
  req.body.title = String(body.title).trim();
  req.body.status = "draft";
  return next();
}

function validateUpdateProperty(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (body.title !== undefined) {
    if (!isPresent(body.title)) {
      pushError(errors, "title", "Title cannot be empty");
    } else if (String(body.title).trim().length > 200) {
      pushError(errors, "title", "Title must be at most 200 characters");
    }
  }

  if (body.purpose !== undefined) {
    if (!PURPOSE_VALUES.includes(String(body.purpose).toLowerCase())) {
      pushError(errors, "purpose", `Purpose must be one of: ${PURPOSE_VALUES.join(", ")}`);
    }
  }

  if (body.category !== undefined) {
    if (!CATEGORY_VALUES.includes(String(body.category).toLowerCase())) {
      pushError(
        errors,
        "category",
        `Category must be one of: ${CATEGORY_VALUES.join(", ")}`
      );
    }
  }

  if (body.status !== undefined) {
    pushError(
      errors,
      "status",
      "Use PATCH /api/properties/:id/status to change property status"
    );
  }

  validateNumericFields(body, errors);
  validateFeatures(body, errors);

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  if (body.purpose !== undefined) {
    req.body.purpose = String(body.purpose).toLowerCase();
  }
  if (body.category !== undefined) {
    req.body.category = String(body.category).toLowerCase();
  }
  if (body.title !== undefined) {
    req.body.title = String(body.title).trim();
  }
  return next();
}

function validateStatusChange(req, res, next) {
  const status = req.body && req.body.status;
  const errors = [];

  if (!isPresent(status)) {
    pushError(errors, "status", "Status is required");
  } else if (!STATUS_VALUES.includes(String(status).toLowerCase())) {
    pushError(errors, "status", `Status must be one of: ${STATUS_VALUES.join(", ")}`);
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.status = String(status).toLowerCase();
  return next();
}

function validateNumericFields(body, errors) {
  const nonNegative = [
    ["coveredArea", "Covered area"],
    ["plotSize", "Plot size"],
    ["askingPrice", "Asking price"],
    ["monthlyRent", "Monthly rent"],
    ["securityDeposit", "Security deposit"],
    ["propertyAgeYears", "Property age"],
    ["advanceRentMonths", "Advance rent months"],
  ];

  for (const [field, label] of nonNegative) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== "") {
      const num = Number(body[field]);
      if (Number.isNaN(num) || num < 0) {
        pushError(errors, field, `${label} must be a non-negative number`);
      }
    }
  }

  if (
    body.propertyRating !== undefined &&
    body.propertyRating !== null &&
    body.propertyRating !== ""
  ) {
    const rating = Number(body.propertyRating);
    if (Number.isNaN(rating) || rating < 0 || rating > 5) {
      pushError(errors, "propertyRating", "Property rating must be between 0 and 5");
    }
  }

  if (
    body.primaryPaymentMethodId !== undefined &&
    body.primaryPaymentMethodId !== null &&
    body.primaryPaymentMethodId !== ""
  ) {
    const id = Number(body.primaryPaymentMethodId);
    if (!Number.isInteger(id) || id <= 0) {
      pushError(errors, "primaryPaymentMethodId", "Payment method id must be a positive integer");
    }
  }
}

function validateIdParam(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return next(new ApiError(400, "Invalid property id"));
  }
  req.params.id = id;
  return next();
}

module.exports = {
  validateCreateProperty,
  validateUpdateProperty,
  validateStatusChange,
  validateIdParam,
};
