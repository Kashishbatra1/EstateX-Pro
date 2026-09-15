/**
 * Recycle Bin — list soft-deleted rows via v_recycle_bin;
 * restore clears deleted_at; purge permanently deletes (with FK cleanup).
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");

const RESTORE_MAP = {
  property: "properties",
  owner: "owners",
  client: "clients",
  booking: "bookings",
  expense: "expenses",
  vendor: "vendors",
  inventory_item: "inventory_items",
  employee: "employees",
  bank_account: "bank_accounts",
  commission: "commissions",
  payment: "payments",
  property_document: "property_documents",
  property_media: "property_media",
  property_transfer: "property_transfers",
  recurring_expense: "recurring_expenses",
  budget: "budgets",
  petty_cash_account: "petty_cash_accounts",
  client_kyc_document: "client_kyc_documents",
  vendor_document: "vendor_documents",
  maintenance_task: "maintenance_tasks",
};

/**
 * Ordered cleanup SQL so RESTRICT FKs do not block permanent delete.
 * $1 is always the entity id being purged.
 */
const PURGE_PREP = {
  property: [
    `DELETE FROM payments
     WHERE booking_id IN (SELECT id FROM bookings WHERE property_id = $1)`,
    `DELETE FROM commissions WHERE property_id = $1`,
    `DELETE FROM bookings WHERE property_id = $1`,
    `DELETE FROM property_transfers WHERE property_id = $1`,
  ],
  booking: [
    `DELETE FROM payments WHERE booking_id = $1`,
    `DELETE FROM commissions WHERE booking_id = $1`,
  ],
  client: [
    `DELETE FROM payments
     WHERE booking_id IN (SELECT id FROM bookings WHERE client_id = $1)`,
    `DELETE FROM commissions
     WHERE booking_id IN (SELECT id FROM bookings WHERE client_id = $1)`,
    `DELETE FROM bookings WHERE client_id = $1`,
  ],
  owner: [
    `DELETE FROM property_owners WHERE owner_id = $1`,
  ],
  bank_account: [
    `DELETE FROM property_bank_accounts WHERE bank_account_id = $1`,
  ],
  vendor: [
    `UPDATE expenses SET vendor_id = NULL WHERE vendor_id = $1`,
    `UPDATE recurring_expenses SET vendor_id = NULL WHERE vendor_id = $1`,
    `UPDATE maintenance_tasks SET vendor_id = NULL WHERE vendor_id = $1`,
  ],
};

async function writeAudit(client, adminId, action, entityType, entityId, newData) {
  await client.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, new_data)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [adminId, action, entityType, entityId, JSON.stringify(newData)]
  );
}

async function listRecycleBin(query = {}) {
  const { entityType, search, page = 1, limit = 30 } = query;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 30));
  const offset = (pageNum - 1) * limitNum;

  const where = ["1=1"];
  const params = [];
  if (entityType) {
    params.push(String(entityType));
    where.push(`entity_type = $${params.length}`);
  }
  if (search && String(search).trim()) {
    params.push(`%${String(search).trim()}%`);
    where.push(`display_name ILIKE $${params.length}`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const count = await pool.query(
    `SELECT COUNT(*)::INT AS total FROM v_recycle_bin ${whereSql}`,
    params
  );
  const listParams = [...params, limitNum, offset];
  const list = await pool.query(
    `SELECT entity_type, entity_id, display_name, deleted_at, deleted_by
     FROM v_recycle_bin
     ${whereSql}
     ORDER BY deleted_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  const total = count.rows[0].total;
  return {
    items: list.rows.map((r) => ({
      entityType: r.entity_type,
      entityId: Number(r.entity_id),
      displayName: r.display_name,
      deletedAt: r.deleted_at,
      deletedBy: r.deleted_by ? Number(r.deleted_by) : null,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    },
  };
}

async function restoreEntity(adminId, entityType, entityId) {
  const table = RESTORE_MAP[entityType];
  if (!table) {
    throw new ApiError(400, "Unsupported entity type for restore", [
      { field: "entityType", message: `Unknown type: ${entityType}` },
    ]);
  }
  const id = Number(entityId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Invalid entityId");
  }

  const result = await pool.query(
    `UPDATE ${table}
     SET deleted_at = NULL,
         deleted_by = NULL
     WHERE id = $1 AND deleted_at IS NOT NULL
     RETURNING id`,
    [id]
  );
  if (!result.rows[0]) {
    throw new ApiError(404, "Deleted item not found or already restored");
  }

  await pool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, new_data)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      adminId,
      "RECYCLE_RESTORE",
      entityType,
      id,
      JSON.stringify({ table, restored: true }),
    ]
  );

  return { entityType, entityId: id, restored: true };
}

/**
 * Permanently remove a soft-deleted row from the recycle bin.
 * Clears RESTRICT dependents first so properties/bookings can actually delete.
 */
async function purgeEntity(adminId, entityType, entityId) {
  const table = RESTORE_MAP[entityType];
  if (!table) {
    throw new ApiError(400, "Unsupported entity type for permanent delete", [
      { field: "entityType", message: `Unknown type: ${entityType}` },
    ]);
  }
  const id = Number(entityId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Invalid entityId");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM ${table} WHERE id = $1 AND deleted_at IS NOT NULL`,
      [id]
    );
    if (!existing.rows[0]) {
      throw new ApiError(404, "Deleted item not found or already removed");
    }

    const prep = PURGE_PREP[entityType] || [];
    for (const sql of prep) {
      await client.query(sql, [id]);
    }

    const result = await client.query(
      `DELETE FROM ${table}
       WHERE id = $1 AND deleted_at IS NOT NULL
       RETURNING id`,
      [id]
    );
    if (!result.rows[0]) {
      throw new ApiError(404, "Deleted item not found or already removed");
    }

    await writeAudit(client, adminId, "RECYCLE_PURGE", entityType, id, {
      table,
      purged: true,
    });

    await client.query("COMMIT");
    return { entityType, entityId: id, purged: true };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    if (err instanceof ApiError) throw err;
    if (err && err.code === "23503") {
      throw new ApiError(
        409,
        "Cannot permanently delete this item because other records still reference it."
      );
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { listRecycleBin, restoreEntity, purgeEntity, RESTORE_MAP };
