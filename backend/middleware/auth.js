/**
 * Authentication & authorization middleware.
 * EstateX Pro: Super Admin and Admin roles.
 */
const ApiError = require("../utils/ApiError");
const { verifyAccessToken } = require("../utils/token");
const authService = require("../services/auth.service");
const asyncHandler = require("../utils/asyncHandler");
const {
  ADMIN_ROLES,
  isAdminRole,
  normalizeAdminRole,
} = require("../utils/adminRoles");

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== "string") return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim();
}

/**
 * Require a valid Admin / Super Admin JWT.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiError(401, "Authentication required");
  }

  const decoded = verifyAccessToken(token);
  const adminId = Number(decoded.sub);

  const admin = await authService.findAdminById(adminId);
  if (!admin || !admin.is_active) {
    throw new ApiError(401, "Authentication required");
  }

  const role = normalizeAdminRole(admin.role) || "admin";
  if (!isAdminRole(role)) {
    throw new ApiError(403, "Insufficient permissions");
  }

  req.auth = {
    adminId,
    email: admin.email,
    role,
    token,
  };
  req.admin = authService.toPublicAdmin(admin);

  next();
});

/**
 * Role-based authorization.
 * Supports `super_admin` and `admin`.
 */
function authorize(...allowedRoles) {
  const roles = allowedRoles.length ? allowedRoles : [...ADMIN_ROLES];

  return (req, res, next) => {
    if (!req.auth || !req.auth.role) {
      return next(new ApiError(401, "Authentication required"));
    }
    if (!roles.includes(req.auth.role)) {
      return next(new ApiError(403, "Insufficient permissions"));
    }
    return next();
  };
}

/** Either Super Admin or Admin may access protected admin routes. */
const requireAdmin = authorize(...ADMIN_ROLES);
const requireSuperAdmin = authorize("super_admin");

module.exports = {
  authenticate,
  authorize,
  requireAdmin,
  requireSuperAdmin,
};
