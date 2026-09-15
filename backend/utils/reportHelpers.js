/**
 * Shared query helpers for dashboard/report filters.
 */
const ApiError = require("./ApiError");

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

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * Validate common report query filters (dates + positive IDs).
 */
function validateReportQuery(query = {}) {
  const errors = [];
  const clean = { ...query };

  const dateFields = ["from", "to", "dateFrom", "dateTo", "bookedFrom", "bookedTo", "paymentFrom", "paymentTo", "expenseFrom", "expenseTo", "createdFrom", "createdTo"];
  for (const field of dateFields) {
    if (clean[field] !== undefined && clean[field] !== null && clean[field] !== "") {
      if (!isValidDateOnly(clean[field])) {
        errors.push({ field, message: `${field} must be YYYY-MM-DD` });
      } else {
        clean[field] = String(clean[field]).slice(0, 10);
      }
    }
  }

  const idFields = [
    "propertyId",
    "clientId",
    "bookingId",
    "paymentMethodId",
    "categoryId",
    "vendorId",
  ];
  for (const field of idFields) {
    if (clean[field] !== undefined && clean[field] !== null && clean[field] !== "") {
      const id = Number(clean[field]);
      if (!Number.isInteger(id) || id <= 0) {
        errors.push({ field, message: `Valid ${field} is required` });
      } else {
        clean[field] = id;
      }
    }
  }

  // Normalize aliases
  if (clean.from && !clean.dateFrom) clean.dateFrom = clean.from;
  if (clean.to && !clean.dateTo) clean.dateTo = clean.to;

  if (
    clean.dateFrom &&
    clean.dateTo &&
    isValidDateOnly(clean.dateFrom) &&
    isValidDateOnly(clean.dateTo) &&
    clean.dateFrom > clean.dateTo
  ) {
    errors.push({ field: "dateFrom/dateTo", message: "dateFrom cannot be after dateTo" });
  }

  if (errors.length) {
    throw new ApiError(400, "Validation failed", errors);
  }

  return clean;
}

module.exports = {
  isPresent,
  isValidDateOnly,
  roundMoney,
  toNumber,
  validateReportQuery,
};
