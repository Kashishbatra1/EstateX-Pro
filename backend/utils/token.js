/**
 * JWT helpers for Admin authentication.
 * Never log token contents or secrets.
 */
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const ApiError = require("./ApiError");
const { isAdminRole, normalizeAdminRole } = require("./adminRoles");

function signAdminToken(admin) {
  const role = normalizeAdminRole(admin.role) || "admin";
  const payload = {
    sub: String(admin.id),
    email: admin.email,
    role,
    type: "access",
  };

  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    if (decoded.type !== "access" || !isAdminRole(decoded.role)) {
      throw new ApiError(401, "Invalid authentication token");
    }
    return decoded;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === "TokenExpiredError") {
      throw new ApiError(401, "Authentication token has expired");
    }
    throw new ApiError(401, "Invalid authentication token");
  }
}

module.exports = {
  signAdminToken,
  verifyAccessToken,
};
