/**
 * Validation for Maintenance endpoints.
 */
const ApiError = require("../utils/ApiError");
const {
  STATUSES,
  PRIORITIES,
  WRITABLE_FIELDS,
} = require("../utils/maintenanceMapper");

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
    } else if (String(body.title).trim().length > 200) {
      pushError(errors, "title", "Title must be at most 200 characters");
    } else {
      body.title = String(body.title).trim();
    }
  }

  if (
    !partial ||
    (body.propertyId !== undefined && body.propertyId !== null && body.propertyId !== "")
  ) {
    if (body.propertyId === undefined || body.propertyId === null || body.propertyId === "") {
      if (!partial) pushError(errors, "propertyId", "Property is required");
    } else {
      const id = Number(body.propertyId);
      if (!Number.isInteger(id) || id <= 0) {
        pushError(errors, "propertyId", "Valid property id is required");
      } else {
        body.propertyId = id;
      }
    }
  }

  if (!partial || (body.dueDate !== undefined && body.dueDate !== null && body.dueDate !== "")) {
    if (!isPresent(body.dueDate)) {
      if (!partial) pushError(errors, "dueDate", "Due date is required");
    } else if (!isValidDateOnly(body.dueDate)) {
      pushError(errors, "dueDate", "dueDate must be YYYY-MM-DD");
    } else {
      body.dueDate = String(body.dueDate).slice(0, 10);
    }
  }

  if (body.status !== undefined && body.status !== null && body.status !== "") {
    if (!STATUSES.includes(String(body.status))) {
      pushError(errors, "status", `Status must be one of: ${STATUSES.join(", ")}`);
    } else {
      body.status = String(body.status);
    }
  } else if (!partial) {
    body.status = "scheduled";
  }

  if (body.priority !== undefined && body.priority !== null && body.priority !== "") {
    if (!PRIORITIES.includes(String(body.priority))) {
      pushError(errors, "priority", `Priority must be one of: ${PRIORITIES.join(", ")}`);
    } else {
      body.priority = String(body.priority);
    }
  } else if (!partial) {
    body.priority = "medium";
  }

  if (body.category !== undefined && body.category !== null) {
    body.category = String(body.category).trim().slice(0, 100) || null;
  }
  if (body.description !== undefined && body.description !== null) {
    body.description = String(body.description);
  }
  if (body.notes !== undefined && body.notes !== null) {
    body.notes = String(body.notes);
  }

  if (body.assignedTo !== undefined && body.assignedTo !== null && body.assignedTo !== "") {
    const id = Number(body.assignedTo);
    if (!Number.isInteger(id) || id <= 0) {
      pushError(errors, "assignedTo", "Valid employee id is required");
    } else {
      body.assignedTo = id;
    }
  } else if (body.assignedTo === "" || body.assignedTo === null) {
    body.assignedTo = null;
  }

  if (body.vendorId !== undefined && body.vendorId !== null && body.vendorId !== "") {
    const id = Number(body.vendorId);
    if (!Number.isInteger(id) || id <= 0) {
      pushError(errors, "vendorId", "Valid vendor id is required");
    } else {
      body.vendorId = id;
    }
  } else if (body.vendorId === "" || body.vendorId === null) {
    body.vendorId = null;
  }

  for (const field of ["estimatedCost", "actualCost"]) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== "") {
      const n = Number(body[field]);
      if (Number.isNaN(n) || n < 0) {
        pushError(errors, field, `${field} must be a non-negative number`);
      } else {
        body[field] = n;
      }
    } else if (body[field] === "" || body[field] === null) {
      body[field] = null;
    }
  }

  if (
    body.reminderDaysBefore !== undefined &&
    body.reminderDaysBefore !== null &&
    body.reminderDaysBefore !== ""
  ) {
    const r = Number(body.reminderDaysBefore);
    if (!Number.isInteger(r) || r < 0) {
      pushError(errors, "reminderDaysBefore", "Must be a non-negative integer");
    } else {
      body.reminderDaysBefore = r;
    }
  } else if (!partial) {
    body.reminderDaysBefore = 3;
  }
}

function validateCreateMaintenance(req, res, next) {
  const body = req.body || {};
  const errors = [];
  validateSharedFields(body, errors, { partial: false });
  if (errors.length) return next(new ApiError(400, "Validation failed", errors));
  req.body = body;
  return next();
}

function validateUpdateMaintenance(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const keys = Object.keys(WRITABLE_FIELDS);
  if (!keys.some((k) => body[k] !== undefined)) {
    return next(
      new ApiError(400, "Validation failed", [
        { field: "body", message: "No updatable fields provided" },
      ])
    );
  }
  validateSharedFields(body, errors, { partial: true });
  if (errors.length) return next(new ApiError(400, "Validation failed", errors));
  req.body = body;
  return next();
}

module.exports = {
  validateIdParam,
  validateCreateMaintenance,
  validateUpdateMaintenance,
};
