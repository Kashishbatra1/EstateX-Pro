const ApiError = require("../utils/ApiError");
const env = require("../config/env");

/**
 * Centralized Express error handler (Phase 1 foundation).
 * Never exposes credentials or stack traces in production.
 */
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let details = err.details || null;

  // PostgreSQL common errors (no sensitive detail leakage)
  if (err.code === "23505") {
    statusCode = 409;
    message = "Duplicate record conflicts with an existing value";
  } else if (err.code === "23503") {
    statusCode = 400;
    message = "Related record not found or cannot be removed due to references";
  } else if (err.code === "23514") {
    statusCode = 400;
    message = err.message || "Database constraint check failed";
  } else if (err.code === "P0001") {
    statusCode = 400;
    message = err.message || "Database business rule rejected the request";
  } else if (err.code === "22P02") {
    statusCode = 400;
    message = "Invalid data format";
  }

  if (!(err instanceof ApiError) && statusCode === 500 && !env.isDev) {
    message = "Internal server error";
    details = null;
  }

  if (env.isDev && statusCode >= 500) {
    console.error("[error]", err.message);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });
}

module.exports = errorHandler;
