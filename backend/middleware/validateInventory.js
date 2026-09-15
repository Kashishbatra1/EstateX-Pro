const ApiError = require("../utils/ApiError");
const { INVENTORY_STATUSES } = require("../utils/inventoryMapper");

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

function validateCreateInventory(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (!isPresent(body.itemName)) {
    pushError(errors, "itemName", "Item name is required");
  } else if (String(body.itemName).trim().length > 150) {
    pushError(errors, "itemName", "Item name must be at most 150 characters");
  }

  if (body.quantity !== undefined && body.quantity !== null && body.quantity !== "") {
    const q = Number(body.quantity);
    if (Number.isNaN(q) || q < 0) {
      pushError(errors, "quantity", "Quantity must be a non-negative number");
    }
  }

  if (body.purchaseCost !== undefined && body.purchaseCost !== null && body.purchaseCost !== "") {
    const c = Number(body.purchaseCost);
    if (Number.isNaN(c) || c < 0) {
      pushError(errors, "purchaseCost", "Purchase cost must be a non-negative number");
    }
  }

  if (body.status !== undefined && body.status !== null && body.status !== "") {
    if (!INVENTORY_STATUSES.includes(String(body.status).toLowerCase())) {
      pushError(
        errors,
        "status",
        `Status must be one of: ${INVENTORY_STATUSES.join(", ")}`
      );
    } else {
      req.body.status = String(body.status).toLowerCase();
    }
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.itemName = String(body.itemName).trim();
  if (body.itemType === "") req.body.itemType = null;
  if (body.unit === "") req.body.unit = "pcs";
  if (body.locationNotes === "") req.body.locationNotes = null;
  if (body.notes === "") req.body.notes = null;
  if (body.purchaseDate === "") req.body.purchaseDate = null;
  if (body.quantity !== undefined && body.quantity !== null && body.quantity !== "") {
    req.body.quantity = Number(body.quantity);
  }
  if (body.purchaseCost !== undefined && body.purchaseCost !== null && body.purchaseCost !== "") {
    req.body.purchaseCost = Number(body.purchaseCost);
  }
  return next();
}

function validateUpdateInventory(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const hasAny =
    body.itemName !== undefined ||
    body.itemType !== undefined ||
    body.quantity !== undefined ||
    body.unit !== undefined ||
    body.status !== undefined ||
    body.locationNotes !== undefined ||
    body.purchaseDate !== undefined ||
    body.purchaseCost !== undefined ||
    body.notes !== undefined;

  if (!hasAny) {
    return next(
      new ApiError(400, "Validation failed", [
        { field: "body", message: "No updatable fields provided" },
      ])
    );
  }

  if (body.itemName !== undefined) {
    if (!isPresent(body.itemName)) {
      pushError(errors, "itemName", "Item name cannot be empty");
    } else {
      req.body.itemName = String(body.itemName).trim();
    }
  }

  if (body.quantity !== undefined && body.quantity !== null && body.quantity !== "") {
    const q = Number(body.quantity);
    if (Number.isNaN(q) || q < 0) {
      pushError(errors, "quantity", "Quantity must be a non-negative number");
    } else {
      req.body.quantity = q;
    }
  }

  if (body.purchaseCost !== undefined && body.purchaseCost !== null && body.purchaseCost !== "") {
    const c = Number(body.purchaseCost);
    if (Number.isNaN(c) || c < 0) {
      pushError(errors, "purchaseCost", "Purchase cost must be a non-negative number");
    } else {
      req.body.purchaseCost = c;
    }
  } else if (body.purchaseCost === "") {
    req.body.purchaseCost = null;
  }

  if (body.status !== undefined && body.status !== null && body.status !== "") {
    if (!INVENTORY_STATUSES.includes(String(body.status).toLowerCase())) {
      pushError(
        errors,
        "status",
        `Status must be one of: ${INVENTORY_STATUSES.join(", ")}`
      );
    } else {
      req.body.status = String(body.status).toLowerCase();
    }
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }
  if (body.itemType === "") req.body.itemType = null;
  if (body.locationNotes === "") req.body.locationNotes = null;
  if (body.notes === "") req.body.notes = null;
  if (body.purchaseDate === "") req.body.purchaseDate = null;
  return next();
}

function validateAssign(req, res, next) {
  const body = req.body || {};
  const errors = [];
  if (!isPresent(body.employeeId) && !isPresent(body.assignedTo)) {
    pushError(errors, "employeeId", "Employee id is required for assignment");
  }
  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }
  const raw = body.employeeId !== undefined ? body.employeeId : body.assignedTo;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return next(
      new ApiError(400, "Validation failed", [
        { field: "employeeId", message: "Valid employee id is required" },
      ])
    );
  }
  req.body.employeeId = id;
  if (body.notes === "") req.body.notes = null;
  return next();
}

function validateAdjust(req, res, next) {
  const body = req.body || {};
  if (body.quantityChange === undefined || body.quantityChange === null || body.quantityChange === "") {
    return next(
      new ApiError(400, "Validation failed", [
        { field: "quantityChange", message: "quantityChange is required" },
      ])
    );
  }
  const n = Number(body.quantityChange);
  if (Number.isNaN(n) || n === 0) {
    return next(
      new ApiError(400, "Validation failed", [
        {
          field: "quantityChange",
          message: "quantityChange must be a non-zero number",
        },
      ])
    );
  }
  req.body.quantityChange = n;
  if (body.notes === "") req.body.notes = null;
  return next();
}

module.exports = {
  validateIdParam,
  validateCreateInventory,
  validateUpdateInventory,
  validateAssign,
  validateAdjust,
};
