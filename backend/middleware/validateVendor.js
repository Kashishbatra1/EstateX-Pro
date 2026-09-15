const ApiError = require("../utils/ApiError");

function pushError(errors, field, message) {
  errors.push({ field, message });
}

function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
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

function validateCreateVendor(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (!isPresent(body.vendorName)) {
    pushError(errors, "vendorName", "Vendor name is required");
  } else if (String(body.vendorName).trim().length > 150) {
    pushError(errors, "vendorName", "Vendor name must be at most 150 characters");
  }

  if (body.email && String(body.email).trim() !== "") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) {
      pushError(errors, "email", "Email format is invalid");
    }
  }

  if (
    body.outstandingBalance !== undefined &&
    body.outstandingBalance !== null &&
    body.outstandingBalance !== ""
  ) {
    const n = Number(body.outstandingBalance);
    if (Number.isNaN(n) || n < 0) {
      pushError(errors, "outstandingBalance", "Must be a non-negative number");
    }
  }

  if (body.contractStartDate && body.contractEndDate) {
    if (new Date(body.contractStartDate) > new Date(body.contractEndDate)) {
      pushError(
        errors,
        "contractEndDate",
        "Contract end date must be on or after start date"
      );
    }
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.vendorName = String(body.vendorName).trim();
  if (body.isPreferred !== undefined) {
    req.body.isPreferred =
      body.isPreferred === true ||
      body.isPreferred === "true" ||
      body.isPreferred === 1;
  }
  return next();
}

function validateUpdateVendor(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const keys = [
    "vendorName",
    "contactPerson",
    "phone",
    "email",
    "address",
    "services",
    "contractStartDate",
    "contractEndDate",
    "paymentTerms",
    "isPreferred",
    "outstandingBalance",
    "notes",
  ];
  if (!keys.some((k) => body[k] !== undefined)) {
    return next(
      new ApiError(400, "Validation failed", [
        { field: "body", message: "No updatable fields provided" },
      ])
    );
  }

  if (body.vendorName !== undefined && !isPresent(body.vendorName)) {
    pushError(errors, "vendorName", "Vendor name cannot be empty");
  }

  if (body.email && String(body.email).trim() !== "") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) {
      pushError(errors, "email", "Email format is invalid");
    }
  }

  if (
    body.outstandingBalance !== undefined &&
    body.outstandingBalance !== null &&
    body.outstandingBalance !== ""
  ) {
    const n = Number(body.outstandingBalance);
    if (Number.isNaN(n) || n < 0) {
      pushError(errors, "outstandingBalance", "Must be a non-negative number");
    } else {
      req.body.outstandingBalance = n;
    }
  }

  if (body.isPreferred !== undefined) {
    req.body.isPreferred =
      body.isPreferred === true ||
      body.isPreferred === "true" ||
      body.isPreferred === 1;
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }
  return next();
}

function validateVendorPayment(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const amount = Number(body.amount);
  if (body.amount === undefined || body.amount === null || body.amount === "") {
    pushError(errors, "amount", "Amount is required");
  } else if (Number.isNaN(amount) || amount <= 0) {
    pushError(errors, "amount", "Amount must be greater than zero");
  } else {
    req.body.amount = amount;
  }
  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }
  return next();
}

function validateVendorDocument(req, res, next) {
  const body = req.body || {};
  const errors = [];
  if (!isPresent(body.filePath)) {
    pushError(errors, "filePath", "File path or URL is required");
  }
  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }
  req.body.filePath = String(body.filePath).trim();
  return next();
}

module.exports = {
  validateIdParam,
  validateCreateVendor,
  validateUpdateVendor,
  validateVendorPayment,
  validateVendorDocument,
};
