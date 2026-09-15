/**
 * Validation for Recurring Expenses endpoints.
 */
const ApiError = require("../utils/ApiError");
const { FREQUENCIES } = require("../utils/recurringMapper");

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

function validateSharedFields(body, errors, { partial = false } = {}) {
  if (!partial || body.title !== undefined) {
    if (!isPresent(body.title)) {
      if (!partial) pushError(errors, "title", "Title is required");
      else pushError(errors, "title", "Title cannot be empty");
    } else if (String(body.title).trim().length > 150) {
      pushError(errors, "title", "Title must be at most 150 characters");
    } else {
      body.title = String(body.title).trim();
    }
  }

  if (!partial || (body.amount !== undefined && body.amount !== null && body.amount !== "")) {
    if (body.amount === undefined || body.amount === null || body.amount === "") {
      if (!partial) pushError(errors, "amount", "Amount is required");
    } else {
      const n = Number(body.amount);
      if (Number.isNaN(n) || n < 0) {
        pushError(errors, "amount", "Amount must be a non-negative number");
      } else {
        body.amount = n;
      }
    }
  }

  if (body.frequency !== undefined && body.frequency !== null && body.frequency !== "") {
    if (!FREQUENCIES.includes(String(body.frequency))) {
      pushError(
        errors,
        "frequency",
        `Frequency must be one of: ${FREQUENCIES.join(", ")}`
      );
    } else {
      body.frequency = String(body.frequency);
    }
  } else if (!partial) {
    body.frequency = "monthly";
  }

  if (body.categoryId !== undefined && body.categoryId !== null && body.categoryId !== "") {
    const c = Number(body.categoryId);
    if (!Number.isInteger(c) || c <= 0) {
      pushError(errors, "categoryId", "Valid category id is required");
    } else {
      body.categoryId = c;
    }
  } else if (body.categoryId === "" || body.categoryId === null) {
    body.categoryId = null;
  }

  if (body.vendorId !== undefined && body.vendorId !== null && body.vendorId !== "") {
    const v = Number(body.vendorId);
    if (!Number.isInteger(v) || v <= 0) {
      pushError(errors, "vendorId", "Valid vendor id is required");
    } else {
      body.vendorId = v;
    }
  } else if (body.vendorId === "" || body.vendorId === null) {
    body.vendorId = null;
  }

  if (body.dueDay !== undefined && body.dueDay !== null && body.dueDay !== "") {
    const d = Number(body.dueDay);
    if (!Number.isInteger(d) || d < 1 || d > 28) {
      pushError(errors, "dueDay", "Due day must be an integer from 1 to 28");
    } else {
      body.dueDay = d;
    }
  } else if (body.dueDay === "" || body.dueDay === null) {
    body.dueDay = null;
  }

  if (
    body.nextDueDate !== undefined &&
    body.nextDueDate !== null &&
    body.nextDueDate !== ""
  ) {
    if (!isValidDateOnly(body.nextDueDate)) {
      pushError(errors, "nextDueDate", "nextDueDate must be YYYY-MM-DD");
    } else {
      body.nextDueDate = String(body.nextDueDate).slice(0, 10);
    }
  } else if (body.nextDueDate === "" || body.nextDueDate === null) {
    body.nextDueDate = null;
  }

  if (
    body.reminderDaysBefore !== undefined &&
    body.reminderDaysBefore !== null &&
    body.reminderDaysBefore !== ""
  ) {
    const r = Number(body.reminderDaysBefore);
    if (!Number.isInteger(r) || r < 0) {
      pushError(
        errors,
        "reminderDaysBefore",
        "Reminder days before must be a non-negative integer"
      );
    } else {
      body.reminderDaysBefore = r;
    }
  }

  if (
    body.annualEscalationPct !== undefined &&
    body.annualEscalationPct !== null &&
    body.annualEscalationPct !== ""
  ) {
    const p = Number(body.annualEscalationPct);
    if (Number.isNaN(p) || p < 0) {
      pushError(
        errors,
        "annualEscalationPct",
        "Annual escalation must be a non-negative number"
      );
    } else {
      body.annualEscalationPct = p;
    }
  }

  if (body.autoDebitFlag !== undefined) {
    body.autoDebitFlag = coerceBool(body.autoDebitFlag);
  }

  if (body.isActive !== undefined) {
    body.isActive = coerceBool(body.isActive);
  }

  if (body.notes !== undefined && body.notes !== null) {
    body.notes = String(body.notes);
  }
}

function validateCreateRecurring(req, res, next) {
  const body = req.body || {};
  const errors = [];
  validateSharedFields(body, errors, { partial: false });
  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }
  req.body = body;
  return next();
}

function validateUpdateRecurring(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const keys = Object.keys(require("../utils/recurringMapper").WRITABLE_FIELDS);
  if (!keys.some((k) => body[k] !== undefined)) {
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

module.exports = {
  validateIdParam,
  validateCreateRecurring,
  validateUpdateRecurring,
};
