const authService = require("../services/auth.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const register = asyncHandler(async (req, res) => {
  const { fullName, email, password, role } = req.body;
  const result = await authService.register({ fullName, email, password, role });
  return success(res, 201, "Registration successful", result);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  return success(res, 200, "Login successful", result);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.auth && req.auth.adminId);
  return success(res, 200, "Logout successful", { loggedOut: true });
});

const me = asyncHandler(async (req, res) => {
  const admin = await authService.getCurrentAdmin(req.auth.adminId);
  return success(res, 200, "Current admin profile", { admin });
});

/** Protected smoke endpoint for authorization testing */
const adminPing = asyncHandler(async (req, res) => {
  return success(res, 200, "Admin access granted", {
    role: req.auth.role,
    adminId: req.auth.adminId,
    email: req.auth.email,
  });
});

module.exports = {
  register,
  login,
  logout,
  me,
  adminPing,
};
