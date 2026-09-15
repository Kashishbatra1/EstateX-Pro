/**
 * Authentication service — Super Admin + Admin (EstateX Pro).
 * Uses real PostgreSQL `admins` table. Never logs passwords or tokens.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const { verifyPassword, hashPassword } = require("../utils/password");
const { signAdminToken } = require("../utils/token");
const {
  normalizeAdminRole,
  formatAdminRoleLabel,
} = require("../utils/adminRoles");

function toPublicAdmin(row) {
  const role = normalizeAdminRole(row.role) || "admin";
  return {
    id: Number(row.id),
    fullName: row.full_name,
    email: row.email,
    role,
    roleLabel: formatAdminRoleLabel(role),
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
  };
}

async function findAdminByEmail(email) {
  const result = await pool.query(
    `SELECT id, full_name, email, password_hash, role, is_active, last_login_at
     FROM admins
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function findAdminById(id) {
  const result = await pool.query(
    `SELECT id, full_name, email, role, is_active, last_login_at
     FROM admins
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Public registration for Super Admin or Admin accounts.
 */
async function register({ fullName, email, password, role }) {
  const normalizedRole = normalizeAdminRole(role);
  if (!normalizedRole) {
    throw new ApiError(400, "Validation failed", [
      {
        field: "role",
        message: "Role must be Super Admin or Admin",
      },
    ]);
  }

  const existing = await findAdminByEmail(email);
  if (existing) {
    throw new ApiError(409, "Email is already registered", [
      { field: "email", message: "An account with this email already exists" },
    ]);
  }

  const passwordHash = await hashPassword(password);

  let row;
  try {
    const inserted = await pool.query(
      `INSERT INTO admins (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, full_name, email, role, is_active, last_login_at`,
      [fullName, email, passwordHash, normalizedRole]
    );
    row = inserted.rows[0];
  } catch (err) {
    if (err && err.code === "23505") {
      throw new ApiError(409, "Email is already registered", [
        { field: "email", message: "An account with this email already exists" },
      ]);
    }
    throw err;
  }

  await pool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, new_data)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      row.id,
      "ADMIN_REGISTER",
      "admin",
      row.id,
      JSON.stringify({
        email: row.email,
        role: row.role,
        at: new Date().toISOString(),
      }),
    ]
  );

  return { admin: toPublicAdmin(row) };
}

async function login(email, password) {
  const admin = await findAdminByEmail(email);

  if (!admin || !admin.is_active) {
    throw new ApiError(401, "Invalid email or password");
  }

  const { valid, needsRehash } = await verifyPassword(
    password,
    admin.password_hash
  );
  if (!valid) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (needsRehash) {
    const newHash = await hashPassword(password);
    await pool.query(
      `UPDATE admins SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newHash, admin.id]
    );
  }

  await pool.query(
    `UPDATE admins SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [admin.id]
  );

  await pool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, new_data)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      admin.id,
      "ADMIN_LOGIN",
      "admin",
      admin.id,
      JSON.stringify({
        email: admin.email,
        role: admin.role,
        at: new Date().toISOString(),
      }),
    ]
  );

  const token = signAdminToken(admin);

  return {
    token,
    tokenType: "Bearer",
    expiresIn: require("../config/env").jwt.expiresIn,
    admin: toPublicAdmin({ ...admin, last_login_at: new Date().toISOString() }),
  };
}

async function logout(adminId) {
  if (adminId) {
    await pool.query(
      `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, new_data)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        adminId,
        "ADMIN_LOGOUT",
        "admin",
        adminId,
        JSON.stringify({ at: new Date().toISOString() }),
      ]
    );
  }
  return { loggedOut: true };
}

async function getCurrentAdmin(adminId) {
  const admin = await findAdminById(adminId);
  if (!admin || !admin.is_active) {
    throw new ApiError(401, "Admin account is inactive or not found");
  }
  return toPublicAdmin(admin);
}

module.exports = {
  register,
  login,
  logout,
  getCurrentAdmin,
  findAdminById,
  toPublicAdmin,
};
