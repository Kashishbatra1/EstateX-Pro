/**
 * Admin role helpers — Super Admin and Admin are both required roles.
 */
const ADMIN_ROLES = ["super_admin", "admin"];

function normalizeAdminRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (value === "superadmin") return "super_admin";
  if (ADMIN_ROLES.includes(value)) return value;
  return null;
}

function isAdminRole(role) {
  return ADMIN_ROLES.includes(normalizeAdminRole(role) || role);
}

function formatAdminRoleLabel(role) {
  const normalized = normalizeAdminRole(role) || role;
  if (normalized === "super_admin") return "Super Admin";
  if (normalized === "admin") return "Admin";
  return "Administrator";
}

module.exports = {
  ADMIN_ROLES,
  normalizeAdminRole,
  isAdminRole,
  formatAdminRoleLabel,
};
