/**
 * Recurring Expenses service — CRUD + optional due-soon reminders.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  WRITABLE_FIELDS,
  toPublicRecurring,
} = require("../utils/recurringMapper");
const {
  createNotificationRecord,
  notificationExists,
} = require("./notification.service");

const DETAIL_SELECT = `
  SELECT re.*,
         cat.category_name,
         v.vendor_name
  FROM recurring_expenses re
  LEFT JOIN expense_categories cat ON cat.id = re.category_id
  LEFT JOIN vendors v ON v.id = re.vendor_id
`;

async function writeAudit(clientOrPool, adminId, action, entityId, oldData, newData) {
  await clientOrPool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, 'recurring_expenses', $3, $4::jsonb, $5::jsonb)`,
    [
      adminId,
      action,
      entityId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
    ]
  );
}

function buildWritableColumns(input) {
  const columns = [];
  const values = [];
  for (const [apiKey, dbCol] of Object.entries(WRITABLE_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(input, apiKey)) {
      let value = input[apiKey];
      if (value === "") value = null;
      columns.push(dbCol);
      values.push(value);
    }
  }
  return { columns, values };
}

async function assertCategory(categoryId) {
  if (categoryId === null || categoryId === undefined) return;
  const result = await pool.query(
    `SELECT id, is_active FROM expense_categories WHERE id = $1 LIMIT 1`,
    [categoryId]
  );
  if (!result.rows[0]) {
    throw new ApiError(400, "Expense category not found", [
      { field: "categoryId", message: "Valid category is required" },
    ]);
  }
  if (!result.rows[0].is_active) {
    throw new ApiError(400, "Expense category is inactive", [
      { field: "categoryId", message: "Select an active category" },
    ]);
  }
}

async function assertVendor(vendorId) {
  if (vendorId === null || vendorId === undefined) return;
  const result = await pool.query(
    `SELECT id FROM vendors WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [vendorId]
  );
  if (!result.rows[0]) {
    throw new ApiError(400, "Vendor not found", [
      { field: "vendorId", message: "Valid vendor is required" },
    ]);
  }
}

async function getRecurringRow(id, { includeDeleted = false } = {}) {
  const result = await pool.query(
    `${DETAIL_SELECT}
     WHERE re.id = $1 AND ($2::boolean = TRUE OR re.deleted_at IS NULL)
     LIMIT 1`,
    [id, includeDeleted]
  );
  return result.rows[0] || null;
}

async function listRecurring(query = {}) {
  const {
    search,
    frequency,
    active,
    dueSoon,
    categoryId,
    vendorId,
    page = 1,
    limit = 20,
  } = query;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;
  const where = ["re.deleted_at IS NULL"];
  const params = [];

  if (active === "true" || active === true) {
    where.push("re.is_active = TRUE");
  } else if (active === "false" || active === false) {
    where.push("re.is_active = FALSE");
  }

  if (frequency && String(frequency).trim()) {
    params.push(String(frequency).trim());
    where.push(`re.frequency = $${params.length}`);
  }

  if (categoryId) {
    params.push(Number(categoryId));
    where.push(`re.category_id = $${params.length}`);
  }

  if (vendorId) {
    params.push(Number(vendorId));
    where.push(`re.vendor_id = $${params.length}`);
  }

  if (search && String(search).trim()) {
    const term = `%${String(search).trim()}%`;
    params.push(term, term);
    const i = params.length;
    where.push(
      `(re.title ILIKE $${i - 1}
        OR COALESCE(re.notes, '') ILIKE $${i}
        OR COALESCE(cat.category_name, '') ILIKE $${i - 1}
        OR COALESCE(v.vendor_name, '') ILIKE $${i - 1})`
    );
  }

  if (dueSoon === "true" || dueSoon === true) {
    where.push("re.is_active = TRUE");
    where.push("re.next_due_date IS NOT NULL");
    where.push(
      `re.next_due_date <= CURRENT_DATE + re.reminder_days_before`
    );
    where.push(`re.next_due_date >= CURRENT_DATE`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM recurring_expenses re
     LEFT JOIN expense_categories cat ON cat.id = re.category_id
     LEFT JOIN vendors v ON v.id = re.vendor_id
     ${whereSql}`,
    params
  );
  const listParams = [...params, limitNum, offset];
  const listResult = await pool.query(
    `${DETAIL_SELECT}
     ${whereSql}
     ORDER BY
       CASE WHEN re.next_due_date IS NULL THEN 1 ELSE 0 END,
       re.next_due_date ASC,
       re.title ASC,
       re.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );
  const total = countResult.rows[0].total;
  return {
    items: listResult.rows.map(toPublicRecurring),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    },
  };
}

async function getRecurringById(id) {
  const row = await getRecurringRow(id);
  if (!row) throw new ApiError(404, "Recurring expense not found");
  return toPublicRecurring(row);
}

async function createRecurring(input, adminId) {
  await assertCategory(input.categoryId);
  await assertVendor(input.vendorId);

  const { columns, values } = buildWritableColumns(input);
  if (!columns.includes("title")) {
    columns.push("title");
    values.push(input.title);
  }
  if (!columns.includes("amount")) {
    columns.push("amount");
    values.push(input.amount);
  }
  if (!columns.includes("created_by")) {
    columns.push("created_by");
    values.push(adminId);
  }

  const placeholders = columns.map((_, i) => `$${i + 1}`);
  try {
    const result = await pool.query(
      `INSERT INTO recurring_expenses (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING *`,
      values
    );
    const full = await getRecurringRow(result.rows[0].id);
    const item = toPublicRecurring(full);
    await writeAudit(pool, adminId, "RECURRING_CREATE", item.id, null, item);
    return item;
  } catch (err) {
    if (err.code === "23514") {
      throw new ApiError(400, err.message || "Recurring expense failed database checks");
    }
    if (err.code === "23503") {
      throw new ApiError(400, "Invalid category or vendor reference");
    }
    throw err;
  }
}

async function updateRecurring(id, input, adminId) {
  const existing = await getRecurringRow(id);
  if (!existing) throw new ApiError(404, "Recurring expense not found");

  if (input.categoryId !== undefined) await assertCategory(input.categoryId);
  if (input.vendorId !== undefined) await assertVendor(input.vendorId);

  const { columns, values } = buildWritableColumns(input);
  if (!columns.length) throw new ApiError(400, "No updatable fields provided");

  const sets = columns.map((col, i) => `${col} = $${i + 1}`);
  values.push(id);
  try {
    const result = await pool.query(
      `UPDATE recurring_expenses
       SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    if (!result.rows[0]) throw new ApiError(404, "Recurring expense not found");
    const full = await getRecurringRow(id);
    const item = toPublicRecurring(full);
    await writeAudit(
      pool,
      adminId,
      "RECURRING_UPDATE",
      id,
      toPublicRecurring(existing),
      item
    );
    return item;
  } catch (err) {
    if (err.code === "23514") {
      throw new ApiError(400, err.message || "Recurring update failed database checks");
    }
    if (err.code === "23503") {
      throw new ApiError(400, "Invalid category or vendor reference");
    }
    throw err;
  }
}

async function softDeleteRecurring(id, adminId) {
  const existing = await getRecurringRow(id);
  if (!existing) throw new ApiError(404, "Recurring expense not found");

  const result = await pool.query(
    `UPDATE recurring_expenses
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [adminId, id]
  );
  if (!result.rows[0]) throw new ApiError(404, "Recurring expense not found");
  await writeAudit(pool, adminId, "RECURRING_SOFT_DELETE", id, { deletedAt: null }, {
    deletedAt: result.rows[0].deleted_at,
  });
  return {
    id: Number(result.rows[0].id),
    title: result.rows[0].title,
    deletedAt: result.rows[0].deleted_at,
  };
}

/**
 * Create utility_bill notifications for active recurring expenses due soon.
 * Dedupes within reminder window so process can be re-run safely.
 */
async function processDueReminders(adminId = null) {
  const due = await pool.query(
    `SELECT re.*
     FROM recurring_expenses re
     WHERE re.deleted_at IS NULL
       AND re.is_active = TRUE
       AND re.next_due_date IS NOT NULL
       AND re.next_due_date >= CURRENT_DATE
       AND re.next_due_date <= CURRENT_DATE + re.reminder_days_before
     ORDER BY re.next_due_date ASC, re.id ASC`
  );

  const created = [];
  const skipped = [];

  for (const row of due.rows) {
    const title = `Recurring expense due soon`;
    const exists = await notificationExists({
      notificationType: "utility_bill",
      entityType: "recurring_expense",
      entityId: row.id,
      title,
      withinDays: Math.max(1, Number(row.reminder_days_before) || 3),
    });
    if (exists) {
      skipped.push(Number(row.id));
      continue;
    }

    const note = await createNotificationRecord(
      {
        adminId: adminId || null,
        notificationType: "utility_bill",
        title,
        message: `"${row.title}" (${row.frequency}) is due on ${toPublicRecurring(row).nextDueDate} — amount ${row.amount}`,
        entityType: "recurring_expense",
        entityId: Number(row.id),
      },
      { adminId, skipAudit: false }
    );
    created.push(note);
  }

  return {
    scanned: due.rows.length,
    created: created.length,
    skipped: skipped.length,
    notifications: created,
  };
}

module.exports = {
  listRecurring,
  getRecurringById,
  createRecurring,
  updateRecurring,
  softDeleteRecurring,
  processDueReminders,
};
