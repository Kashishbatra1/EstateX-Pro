/**
 * Backup & Restore metadata using approved `backups` table.
 * Creates a JSON snapshot file under uploads/backups (no schema changes).
 */
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");

const BACKUP_DIR = path.join(__dirname, "..", "uploads", "backups");

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function toPublicBackup(row) {
  return {
    id: Number(row.id),
    fileName: row.file_name,
    filePath: row.file_path,
    backupType: row.backup_type,
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdAt: row.created_at,
    restoredAt: row.restored_at || null,
    restoredBy: row.restored_by ? Number(row.restored_by) : null,
  };
}

async function listBackups() {
  const result = await pool.query(
    `SELECT * FROM backups ORDER BY created_at DESC, id DESC LIMIT 100`
  );
  return { items: result.rows.map(toPublicBackup) };
}

async function createBackup(adminId, input = {}) {
  ensureDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `estatex-backup-${stamp}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);

  const pending = await pool.query(
    `INSERT INTO backups (file_name, file_path, backup_type, status, notes, created_by)
     VALUES ($1, $2, $3, 'pending', $4, $5)
     RETURNING *`,
    [
      fileName,
      filePath,
      input.backupType || "full",
      input.notes || "Logical JSON snapshot",
      adminId,
    ]
  );

  try {
    const [
      properties,
      owners,
      clients,
      bookings,
      expenses,
      vendors,
      inventory,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*)::INT AS c FROM properties WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*)::INT AS c FROM owners WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*)::INT AS c FROM clients WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*)::INT AS c FROM bookings WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*)::INT AS c FROM expenses WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*)::INT AS c FROM vendors WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*)::INT AS c FROM inventory_items WHERE deleted_at IS NULL`),
    ]);

    const payload = {
      createdAt: new Date().toISOString(),
      createdBy: adminId,
      database: "estatex_pro",
      counts: {
        properties: properties.rows[0].c,
        owners: owners.rows[0].c,
        clients: clients.rows[0].c,
        bookings: bookings.rows[0].c,
        expenses: expenses.rows[0].c,
        vendors: vendors.rows[0].c,
        inventoryItems: inventory.rows[0].c,
      },
      note: "Metadata snapshot for admin Backup & Restore panel. Full SQL dump can replace this file later.",
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    const sizeBytes = fs.statSync(filePath).size;

    const done = await pool.query(
      `UPDATE backups
       SET status = 'completed', size_bytes = $1
       WHERE id = $2
       RETURNING *`,
      [sizeBytes, pending.rows[0].id]
    );
    return toPublicBackup(done.rows[0]);
  } catch (err) {
    await pool.query(
      `UPDATE backups SET status = 'failed', notes = $1 WHERE id = $2`,
      [String(err.message).slice(0, 500), pending.rows[0].id]
    );
    throw new ApiError(500, "Backup failed", [{ message: err.message }]);
  }
}

async function markRestored(id, adminId) {
  const existing = await pool.query(`SELECT * FROM backups WHERE id = $1`, [id]);
  if (!existing.rows[0]) throw new ApiError(404, "Backup not found");
  if (existing.rows[0].status !== "completed") {
    throw new ApiError(400, "Only completed backups can be marked restored");
  }

  const result = await pool.query(
    `UPDATE backups
     SET status = 'restored',
         restored_at = CURRENT_TIMESTAMP,
         restored_by = $1
     WHERE id = $2
     RETURNING *`,
    [adminId, id]
  );
  return toPublicBackup(result.rows[0]);
}

module.exports = { listBackups, createBackup, markRestored };
