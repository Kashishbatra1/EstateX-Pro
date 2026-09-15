/**
 * Budgets service — CRUD, category lines, spent vs allocated, overspending alerts.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  WRITABLE_FIELDS,
  toPublicBudget,
  toPublicBudgetLine,
} = require("../utils/budgetMapper");
const {
  createNotificationRecord,
  notificationExists,
} = require("./notification.service");

function periodDateRange(periodType, year, month) {
  if (periodType === "monthly") {
    const m = String(month).padStart(2, "0");
    const start = `${year}-${m}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endExclusive = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
    return { start, endExclusive };
  }
  return {
    start: `${year}-01-01`,
    endExclusive: `${year + 1}-01-01`,
  };
}

async function writeAudit(clientOrPool, adminId, action, entityId, oldData, newData) {
  await clientOrPool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, 'budgets', $3, $4::jsonb, $5::jsonb)`,
    [
      adminId,
      action,
      entityId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
    ]
  );
}

async function assertCategory(categoryId, client = pool) {
  const result = await client.query(
    `SELECT id, is_active, category_name FROM expense_categories WHERE id = $1 LIMIT 1`,
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
  return result.rows[0];
}

async function getSpentTotal(periodType, year, month, categoryId = null, client = pool) {
  const { start, endExclusive } = periodDateRange(periodType, year, month);
  const params = [start, endExclusive];
  let categoryClause = "";
  if (categoryId != null) {
    params.push(categoryId);
    categoryClause = ` AND e.category_id = $${params.length}`;
  }
  const result = await client.query(
    `SELECT COALESCE(SUM(e.amount), 0)::NUMERIC AS spent
     FROM expenses e
     WHERE e.deleted_at IS NULL
       AND e.approval_status <> 'rejected'
       AND e.expense_date >= $1::date
       AND e.expense_date < $2::date
       ${categoryClause}`,
    params
  );
  return Number(result.rows[0].spent);
}

async function loadLinesWithSpend(budget, client = pool) {
  const lines = await client.query(
    `SELECT bl.*, cat.category_name
     FROM budget_lines bl
     JOIN expense_categories cat ON cat.id = bl.category_id
     WHERE bl.budget_id = $1
     ORDER BY cat.category_name ASC, bl.id ASC`,
    [budget.id]
  );

  const withSpend = [];
  for (const row of lines.rows) {
    const spent = await getSpentTotal(
      budget.period_type,
      Number(budget.year),
      budget.month != null ? Number(budget.month) : null,
      Number(row.category_id),
      client
    );
    withSpend.push(toPublicBudgetLine({ ...row, spent_amount: spent }));
  }
  return withSpend;
}

async function getBudgetRow(id, { includeDeleted = false, client = pool } = {}) {
  const result = await client.query(
    `SELECT * FROM budgets
     WHERE id = $1 AND ($2::boolean = TRUE OR deleted_at IS NULL)
     LIMIT 1`,
    [id, includeDeleted]
  );
  return result.rows[0] || null;
}

async function assertUniquePeriod(periodType, year, month, excludeId = null, client = pool) {
  const params = [periodType, year];
  let monthClause;
  if (periodType === "annual" || month == null) {
    monthClause = "AND month IS NULL";
  } else {
    params.push(month);
    monthClause = `AND month = $${params.length}`;
  }
  let excludeClause = "";
  if (excludeId != null) {
    params.push(excludeId);
    excludeClause = `AND id <> $${params.length}`;
  }
  const result = await client.query(
    `SELECT id FROM budgets
     WHERE deleted_at IS NULL
       AND period_type = $1
       AND year = $2
       ${monthClause}
       ${excludeClause}
     LIMIT 1`,
    params
  );
  if (result.rows[0]) {
    throw new ApiError(409, "A budget already exists for this period", [
      {
        field: "periodType",
        message: "Only one active budget per period_type/year/month is allowed",
      },
    ]);
  }
}

async function listBudgets(query = {}) {
  const { search, periodType, year, month, page = 1, limit = 20 } = query;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;
  const where = ["b.deleted_at IS NULL"];
  const params = [];

  if (periodType && String(periodType).trim()) {
    params.push(String(periodType).trim());
    where.push(`b.period_type = $${params.length}`);
  }
  if (year !== undefined && year !== null && year !== "") {
    params.push(Number(year));
    where.push(`b.year = $${params.length}`);
  }
  if (month !== undefined && month !== null && month !== "") {
    params.push(Number(month));
    where.push(`b.month = $${params.length}`);
  }
  if (search && String(search).trim()) {
    params.push(`%${String(search).trim()}%`);
    where.push(`b.name ILIKE $${params.length}`);
  }

  const whereSql = where.join(" AND ");
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total FROM budgets b WHERE ${whereSql}`,
    params
  );
  const total = countResult.rows[0].total;

  params.push(limitNum, offset);
  const result = await pool.query(
    `SELECT b.*
     FROM budgets b
     WHERE ${whereSql}
     ORDER BY b.year DESC, b.month DESC NULLS LAST, b.id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const items = [];
  for (const row of result.rows) {
    const spent = await getSpentTotal(
      row.period_type,
      Number(row.year),
      row.month != null ? Number(row.month) : null
    );
    items.push(toPublicBudget(row, { spentAmount: spent }));
  }

  return {
    items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    },
  };
}

async function getBudgetById(id) {
  const row = await getBudgetRow(id);
  if (!row) throw new ApiError(404, "Budget not found");
  const spent = await getSpentTotal(
    row.period_type,
    Number(row.year),
    row.month != null ? Number(row.month) : null
  );
  const lines = await loadLinesWithSpend(row);
  return toPublicBudget(row, { spentAmount: spent, lines });
}

async function insertLines(client, budgetId, lines = []) {
  for (const line of lines) {
    await assertCategory(line.categoryId, client);
    await client.query(
      `INSERT INTO budget_lines (budget_id, category_id, allocated_amount, notes)
       VALUES ($1, $2, $3, $4)`,
      [budgetId, line.categoryId, line.allocatedAmount, line.notes || null]
    );
  }
}

async function createBudget(input, adminId) {
  const periodType = input.periodType;
  const year = input.year;
  const month = periodType === "monthly" ? input.month : null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertUniquePeriod(periodType, year, month, null, client);

    const result = await client.query(
      `INSERT INTO budgets (
         name, period_type, year, month, total_amount, alert_threshold_pct, notes, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.name,
        periodType,
        year,
        month,
        input.totalAmount,
        input.alertThresholdPct != null ? input.alertThresholdPct : 80,
        input.notes || null,
        adminId,
      ]
    );
    const row = result.rows[0];

    if (Array.isArray(input.lines) && input.lines.length) {
      await insertLines(client, row.id, input.lines);
    }

    await writeAudit(client, adminId, "BUDGET_CREATE", row.id, null, {
      name: row.name,
      periodType: row.period_type,
      year: Number(row.year),
      month: row.month != null ? Number(row.month) : null,
      totalAmount: Number(row.total_amount),
    });

    await client.query("COMMIT");
    return getBudgetById(row.id);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      throw new ApiError(409, "A budget already exists for this period");
    }
    throw err;
  } finally {
    client.release();
  }
}

async function updateBudget(id, input, adminId) {
  const existing = await getBudgetRow(id);
  if (!existing) throw new ApiError(404, "Budget not found");

  const nextPeriod =
    input.periodType !== undefined ? input.periodType : existing.period_type;
  const nextYear = input.year !== undefined ? input.year : Number(existing.year);
  let nextMonth =
    input.month !== undefined
      ? input.month
      : existing.month != null
        ? Number(existing.month)
        : null;
  if (nextPeriod === "annual") nextMonth = null;
  if (nextPeriod === "monthly" && (nextMonth == null || nextMonth < 1 || nextMonth > 12)) {
    throw new ApiError(400, "Validation failed", [
      { field: "month", message: "Month is required for monthly budgets" },
    ]);
  }

  const columns = [];
  const values = [];
  for (const [apiKey, dbCol] of Object.entries(WRITABLE_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(input, apiKey)) continue;
    let value = input[apiKey];
    if (apiKey === "month") value = nextMonth;
    if (apiKey === "periodType") value = nextPeriod;
    if (value === "") value = null;
    columns.push(dbCol);
    values.push(value);
  }

  // Always normalize period fields together when any period field changes
  if (
    input.periodType !== undefined ||
    input.year !== undefined ||
    input.month !== undefined
  ) {
    const setPeriod = (col, val) => {
      const idx = columns.indexOf(col);
      if (idx >= 0) values[idx] = val;
      else {
        columns.push(col);
        values.push(val);
      }
    };
    setPeriod("period_type", nextPeriod);
    setPeriod("year", nextYear);
    setPeriod("month", nextMonth);
  }

  if (!columns.length) {
    throw new ApiError(400, "Validation failed", [
      { field: "body", message: "No updatable fields provided" },
    ]);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertUniquePeriod(nextPeriod, nextYear, nextMonth, id, client);

    const setSql = columns.map((c, i) => `${c} = $${i + 1}`).join(", ");
    values.push(id);
    const result = await client.query(
      `UPDATE budgets
       SET ${setSql}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    const row = result.rows[0];
    if (!row) throw new ApiError(404, "Budget not found");

    await writeAudit(
      client,
      adminId,
      "BUDGET_UPDATE",
      id,
      {
        name: existing.name,
        totalAmount: Number(existing.total_amount),
      },
      {
        name: row.name,
        totalAmount: Number(row.total_amount),
      }
    );

    await client.query("COMMIT");
    return getBudgetById(id);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      throw new ApiError(409, "A budget already exists for this period");
    }
    throw err;
  } finally {
    client.release();
  }
}

async function softDeleteBudget(id, adminId) {
  const existing = await getBudgetRow(id);
  if (!existing) throw new ApiError(404, "Budget not found");

  const result = await pool.query(
    `UPDATE budgets
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [adminId, id]
  );
  const row = result.rows[0];
  await writeAudit(pool, adminId, "BUDGET_SOFT_DELETE", id, { name: existing.name }, null);
  return toPublicBudget(row, { spentAmount: 0, lines: [] });
}

async function addBudgetLine(budgetId, input, adminId) {
  const budget = await getBudgetRow(budgetId);
  if (!budget) throw new ApiError(404, "Budget not found");
  await assertCategory(input.categoryId);

  try {
    const result = await pool.query(
      `INSERT INTO budget_lines (budget_id, category_id, allocated_amount, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [budgetId, input.categoryId, input.allocatedAmount, input.notes || null]
    );
    await writeAudit(pool, adminId, "BUDGET_LINE_CREATE", budgetId, null, {
      lineId: Number(result.rows[0].id),
      categoryId: input.categoryId,
      allocatedAmount: input.allocatedAmount,
    });
    const spent = await getSpentTotal(
      budget.period_type,
      Number(budget.year),
      budget.month != null ? Number(budget.month) : null,
      input.categoryId
    );
    const cat = await pool.query(
      `SELECT category_name FROM expense_categories WHERE id = $1`,
      [input.categoryId]
    );
    return toPublicBudgetLine({
      ...result.rows[0],
      category_name: cat.rows[0]?.category_name,
      spent_amount: spent,
    });
  } catch (err) {
    if (err.code === "23505") {
      throw new ApiError(409, "A line for this category already exists on the budget");
    }
    throw err;
  }
}

async function updateBudgetLine(budgetId, lineId, input, adminId) {
  const budget = await getBudgetRow(budgetId);
  if (!budget) throw new ApiError(404, "Budget not found");

  const existing = await pool.query(
    `SELECT * FROM budget_lines WHERE id = $1 AND budget_id = $2 LIMIT 1`,
    [lineId, budgetId]
  );
  if (!existing.rows[0]) throw new ApiError(404, "Budget line not found");

  if (input.categoryId != null) await assertCategory(input.categoryId);

  const columns = [];
  const values = [];
  if (input.categoryId !== undefined) {
    columns.push("category_id");
    values.push(input.categoryId);
  }
  if (input.allocatedAmount !== undefined) {
    columns.push("allocated_amount");
    values.push(input.allocatedAmount);
  }
  if (input.notes !== undefined) {
    columns.push("notes");
    values.push(input.notes);
  }
  if (!columns.length) {
    throw new ApiError(400, "Validation failed", [
      { field: "body", message: "No updatable fields provided" },
    ]);
  }

  values.push(lineId, budgetId);
  try {
    const result = await pool.query(
      `UPDATE budget_lines
       SET ${columns.map((c, i) => `${c} = $${i + 1}`).join(", ")},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $${columns.length + 1} AND budget_id = $${columns.length + 2}
       RETURNING *`,
      values
    );
    await writeAudit(pool, adminId, "BUDGET_LINE_UPDATE", budgetId, null, {
      lineId,
      ...input,
    });
    const row = result.rows[0];
    const spent = await getSpentTotal(
      budget.period_type,
      Number(budget.year),
      budget.month != null ? Number(budget.month) : null,
      Number(row.category_id)
    );
    const cat = await pool.query(
      `SELECT category_name FROM expense_categories WHERE id = $1`,
      [row.category_id]
    );
    return toPublicBudgetLine({
      ...row,
      category_name: cat.rows[0]?.category_name,
      spent_amount: spent,
    });
  } catch (err) {
    if (err.code === "23505") {
      throw new ApiError(409, "A line for this category already exists on the budget");
    }
    throw err;
  }
}

async function deleteBudgetLine(budgetId, lineId, adminId) {
  const budget = await getBudgetRow(budgetId);
  if (!budget) throw new ApiError(404, "Budget not found");

  const result = await pool.query(
    `DELETE FROM budget_lines WHERE id = $1 AND budget_id = $2 RETURNING *`,
    [lineId, budgetId]
  );
  if (!result.rows[0]) throw new ApiError(404, "Budget line not found");

  await writeAudit(pool, adminId, "BUDGET_LINE_DELETE", budgetId, {
    lineId,
    categoryId: Number(result.rows[0].category_id),
  }, null);

  return { id: Number(result.rows[0].id), deleted: true };
}

async function processOverspendAlerts(adminId) {
  const budgets = await pool.query(
    `SELECT * FROM budgets WHERE deleted_at IS NULL ORDER BY id ASC`
  );
  let scanned = 0;
  let created = 0;
  let skipped = 0;

  for (const row of budgets.rows) {
    scanned += 1;
    const spent = await getSpentTotal(
      row.period_type,
      Number(row.year),
      row.month != null ? Number(row.month) : null
    );
    const total = Number(row.total_amount);
    const threshold = Number(row.alert_threshold_pct);
    const utilizationPct = total > 0 ? (spent / total) * 100 : 0;
    if (utilizationPct < threshold) {
      skipped += 1;
      continue;
    }

    const title = `Budget alert: ${row.name}`;
    const exists = await notificationExists({
      notificationType: "budget_overspending",
      entityType: "budgets",
      entityId: row.id,
      title,
      withinDays: 7,
    });
    if (exists) {
      skipped += 1;
      continue;
    }

    await createNotificationRecord(
      {
        adminId: null,
        notificationType: "budget_overspending",
        title,
        message: `${row.name} is at ${utilizationPct.toFixed(1)}% of ${total} (threshold ${threshold}%). Spent: ${spent}.`,
        entityType: "budgets",
        entityId: row.id,
      },
      { adminId }
    );
    created += 1;
  }

  return { scanned, created, skipped };
}

module.exports = {
  listBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  softDeleteBudget,
  addBudgetLine,
  updateBudgetLine,
  deleteBudgetLine,
  processOverspendAlerts,
  periodDateRange,
  getSpentTotal,
};
