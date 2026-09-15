/**
 * Minimal request body validation helpers (Phase 2).
 */
const ApiError = require("../utils/ApiError");

function validateLogin(req, res, next) {
  const email = req.body && req.body.email;
  const password = req.body && req.body.password;
  const errors = [];

  if (email === undefined || email === null || String(email).trim() === "") {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    errors.push({ field: "email", message: "Email format is invalid" });
  }

  if (password === undefined || password === null || String(password) === "") {
    errors.push({ field: "password", message: "Password is required" });
  } else if (String(password).length < 6) {
    errors.push({ field: "password", message: "Password must be at least 6 characters" });
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.email = String(email).trim().toLowerCase();
  req.body.password = String(password);
  return next();
}

function validateRegister(req, res, next) {
  const body = req.body || {};
  const fullName = body.fullName ?? body.full_name;
  const email = body.email;
  const password = body.password;
  const role = body.role;
  const errors = [];

  if (fullName === undefined || fullName === null || String(fullName).trim() === "") {
    errors.push({ field: "fullName", message: "Full name is required" });
  } else if (String(fullName).trim().length > 150) {
    errors.push({ field: "fullName", message: "Full name must be 150 characters or fewer" });
  }

  if (email === undefined || email === null || String(email).trim() === "") {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    errors.push({ field: "email", message: "Email format is invalid" });
  } else if (String(email).trim().length > 150) {
    errors.push({ field: "email", message: "Email must be 150 characters or fewer" });
  }

  if (password === undefined || password === null || String(password) === "") {
    errors.push({ field: "password", message: "Password is required" });
  } else if (String(password).length < 6) {
    errors.push({ field: "password", message: "Password must be at least 6 characters" });
  }

  const { normalizeAdminRole } = require("../utils/adminRoles");
  const normalizedRole = normalizeAdminRole(role);
  if (!normalizedRole) {
    errors.push({
      field: "role",
      message: "Role is required (Super Admin or Admin)",
    });
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.fullName = String(fullName).trim();
  req.body.email = String(email).trim().toLowerCase();
  req.body.password = String(password);
  req.body.role = normalizedRole;
  return next();
}

module.exports = {
  validateLogin,
  validateRegister,
};
