/**
 * Apply admin role migration to the live estatex_pro database.
 * Usage (from backend/): node scripts/apply-admin-roles.js
 */
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

async function main() {
  const sqlPath = path.join(
    __dirname,
    "..",
    "..",
    "database",
    "migrations",
    "add_admin_roles.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");
  await pool.query(sql);
  await pool.query(
    `UPDATE admins
     SET role = 'super_admin'
     WHERE email = 'admin@estatex.pro'
       AND role = 'admin'`
  );
  const result = await pool.query(
    `SELECT id, email, role FROM admins ORDER BY id ASC LIMIT 10`
  );
  console.log("Admin roles migration applied.");
  console.table(result.rows);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
