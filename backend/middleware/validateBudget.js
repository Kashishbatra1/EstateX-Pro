/**
 * Validation for Budgets endpoints.
 */
const ApiError = require("../utils/ApiError");
const { PERIOD_TYPES, WRITABLE_FIELDS } = require("../utils/budgetMapper");

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

function validateSharedFields(body, errors, { partial = false } = {}) {
  if (!partial || body.name !== undefined) {
    if (!isPresent(body.name)) {
      if (!partial) pushError(errors, "name", "Name is required");
      else pushError(errors, "name", "Name cannot be empty");
    } else if (String(body.name).trim().length > 150) {
      pushError(errors, "name", "Name must be at most 150 characters");
    } else {
      body.name = String(body.name).trim();
    }
  }

  if (!partial || body.periodType !== undefined) {
    if (!isPresent(body.periodType)) {
      if (!partial) pushError(errors, "periodType", "Period type is required");
    } else if (!PERIOD_TYPES.includes(String(body.periodType))) {
      pushError(
        errors,
        "periodType",
        `Period type must be one of: ${PERIOD_TYPES.join(", ")}`
      );
    } else {
      body.periodType = String(body.periodType);
    }
  }

  if (!partial || (body.year !== undefined && body.year !== null && body.year !== "")) {
    if (body.year === undefined || body.year === null || body.year === "") {
      if (!partial) pushError(errors, "year", "Year is required");
    } else {
      const y = Number(body.year);
      if (!Number.isInteger(y) || y < 2000 || y > 2100) {
        pushError(errors, "year", "Year must be an integer from 2000 to 2100");
      } else {
        body.year = y;
      }
    }
  }

  if (body.month !== undefined && body.month !== null && body.month !== "") {
    const m = Number(body.month);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      pushError(errors, "month", "Month must be an integer from 1 to 12");
    } else {
      body.month = m;
    }
  } else if (body.month === "" || body.month === null) {
    body.month = null;
  }

  if (
    !partial ||
    (body.totalAmount !== undefined && body.totalAmount !== null && body.totalAmount !== "")
  ) {
    if (
      body.totalAmount === undefined ||
      body.totalAmount === null ||
      body.totalAmount === ""
    ) {
      if (!partial) pushError(errors, "totalAmount", "Total amount is required");
    } else {
      const n = Number(body.totalAmount);
      if (Number.isNaN(n) || n < 0) {
        pushError(errors, "totalAmount", "Total amount must be a non-negative number");
      } else {
        body.totalAmount = n;
      }
    }
  }

  if (
    body.alertThresholdPct !== undefined &&
    body.alertThresholdPct !== null &&
    body.alertThresholdPct !== ""
  ) {
    const p = Number(body.alertThresholdPct);
    if (Number.isNaN(p) || p <= 0 || p > 100) {
      pushError(
        errors,
        "alertThresholdPct",
        "Alert threshold must be greater than 0 and at most 100"
      );
    } else {
      body.alertThresholdPct = p;
    }
  } else if (!partial && (body.alertThresholdPct === undefined || body.alertThresholdPct === "")) {
    body.alertThresholdPct = 80;
  }

  if (body.notes !== undefined && body.notes !== null) {
    body.notes = String(body.notes);
  }

  const periodType = body.periodType;
  if (periodType === "annual") {
    if (body.month != null) {
      pushError(errors, "month", "Month must be empty for annual budgets");
    }
    body.month = null;
  } else if (periodType === "monthly") {
    if (body.month == null && (!partial || body.periodType !== undefined || body.month !== undefined)) {
      if (!partial || body.month !== undefined || body.periodType !== undefined) {
        if (body.month == null) {
          pushError(errors, "month", "Month is required for monthly budgets");
        }
      }
    }
  }

  if (Array.isArray(body.lines)) {
    body.lines.forEach((line, idx) => {
      if (!line || typeof line !== "object") {
        pushError(errors, `lines[${idx}]`, "Invalid line");
        return;
      }
      const cat = Number(line.categoryId);
      if (!Number.isInteger(cat) || cat <= 0) {
        pushError(errors, `lines[${idx}].categoryId`, "Valid category id is required");
      } else {
        line.categoryId = cat;
      }
      const amt = Number(line.allocatedAmount);
      if (Number.isNaN(amt) || amt < 0) {
        pushError(
          errors,
          `lines[${idx}].allocatedAmount`,
          "Allocated amount must be a non-negative number"
        );
      } else {
        line.allocatedAmount = amt;
      }
      if (line.notes !== undefined && line.notes !== null) {
        line.notes = String(line.notes);
      }
    });
  }
}

function validateCreateBudget(req, res, next) {
  const body = req.body || {};
  const errors = [];
  validateSharedFields(body, errors, { partial: false });
  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }
  req.body = body;
  return next();
}

function validateUpdateBudget(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const keys = Object.keys(WRITABLE_FIELDS);
  if (!keys.some((k) => body[k] !== undefined) && body.lines === undefined) {
    return next(
      new ApiError(400, "Validation failed", [
        { field: "body", message: "No updatable fields provided" },
      ])
    );
  }
  validateSharedFields(body, errors, { partial: true });
  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }
  req.body = body;
  return next();
}

function validateBudgetLine(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const cat = Number(body.categoryId);
  if (!Number.isInteger(cat) || cat <= 0) {
    pushError(errors, "categoryId", "Valid category id is required");
  } else {
    body.categoryId = cat;
  }
  const amt = Number(body.allocatedAmount);
  if (body.allocatedAmount === undefined || body.allocatedAmount === null || body.allocatedAmount === "") {
    pushError(errors, "allocatedAmount", "Allocated amount is required");
  } else if (Number.isNaN(amt) || amt < 0) {
    pushError(errors, "allocatedAmount", "Allocated amount must be a non-negative number");
  } else {
    body.allocatedAmount = amt;
  }
  if (body.notes !== undefined && body.notes !== null) {
    body.notes = String(body.notes);
  }
  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }
  req.body = body;
  return next();
}

function validateUpdateBudgetLine(req, res, next) {
  const body = req.body || {};
  const errors = [];
  if (
    body.categoryId === undefined &&
    body.allocatedAmount === undefined &&
    body.notes === undefined
  ) {
    return next(
      new ApiError(400, "Validation failed", [
        { field: "body", message: "No updatable fields provided" },
      ])
    );
  }
  if (body.categoryId !== undefined && body.categoryId !== null && body.categoryId !== "") {
    const cat = Number(body.categoryId);
    if (!Number.isInteger(cat) || cat <= 0) {
      pushError(errors, "categoryId", "Valid category id is required");
    } else {
      body.categoryId = cat;
    }
  }
  if (
    body.allocatedAmount !== undefined &&
    body.allocatedAmount !== null &&
    body.allocatedAmount !== ""
  ) {
    const amt = Number(body.allocatedAmount);
    if (Number.isNaN(amt) || amt < 0) {
      pushError(errors, "allocatedAmount", "Allocated amount must be a non-negative number");
    } else {
      body.allocatedAmount = amt;
    }
  }
  if (body.notes !== undefined && body.notes !== null) {
    body.notes = String(body.notes);
  }
  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }
  req.body = body;
  return next();
}

module.exports = {
  validateIdParam,
  validateCreateBudget,
  validateUpdateBudget,
  validateBudgetLine,
  validateUpdateBudgetLine,
};
