const ApiError = require("../utils/ApiError");
const { EVENT_TYPES } = require("../utils/propertyHistoryMapper");

function validatePropertyIdParam(req, res, next) {
  const raw = req.params.propertyId;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return next(new ApiError(400, "Invalid propertyId"));
  }
  req.params.propertyId = id;
  return next();
}

function validateHistoryQuery(req, res, next) {
  const errors = [];
  const { eventType, page, limit } = req.query;

  if (eventType !== undefined && eventType !== "") {
    const value = String(eventType).toLowerCase();
    if (!EVENT_TYPES.includes(value)) {
      errors.push({
        field: "eventType",
        message: `Must be one of: ${EVENT_TYPES.join(", ")}`,
      });
    } else {
      req.query.eventType = value;
    }
  }

  if (page !== undefined && page !== "") {
    const n = Number(page);
    if (!Number.isInteger(n) || n < 1) {
      errors.push({ field: "page", message: "Must be a positive integer" });
    } else {
      req.query.page = n;
    }
  }

  if (limit !== undefined && limit !== "") {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      errors.push({ field: "limit", message: "Must be an integer between 1 and 100" });
    } else {
      req.query.limit = n;
    }
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }
  return next();
}

module.exports = {
  validatePropertyIdParam,
  validateHistoryQuery,
};
