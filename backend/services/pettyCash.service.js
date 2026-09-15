/**
 * Petty Cash service — accounts, in/out transactions, reconciliations.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  ACCOUNT_WRITABLE,
  toPublicAccount,
  toPublicTxn,
  toPublicReconciliation,
} = require("../utils/pettyCashMapper");

const ACCOUNT_SELECT = `
  SELECT a.*, e.full_name AS custodian_name
  FROM petty_cash_accounts a
  JOIN employees e ON e.id = a.custodian_employee_id
`;

async function writeAudit(clientOrPool, adminId, action, entityId, oldData, newData) {
  await clientOrPool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, 'petty_cash_accounts', $3, $4::jsonb, $5::jsonb)`,
    [
      adminId,
      action,
      entityId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
    ]
  );
}

async function assertActiveEmployee(employeeId, field = "custodianEmployeeId", client = pool) {
  const result = await client.query(
    `SELECT id, full_name, is_active, deleted_at
     FROM employees WHERE id = $1 LIMIT 1`,
    [employeeId]
  );
  const row = result.rows[0];
  if (!row || row.deleted_at) {
    throw new ApiError(400, "Employee not found", [
      { field, message: "Valid employee is required" },
    ]);
  }
  if (!row.is_active) {
    throw new ApiError(400, "Employee is inactive", [
      { field, message: "Active employee is required" },
    ]);
  }
  return row;
}

async function getAccountRow(id, { includeDeleted = false, client = pool } = {}) {
  const result = await client.query(
    `${ACCOUNT_SELECT}
     WHERE a.id = $1 AND ($2::boolean = TRUE OR a.deleted_at IS NULL)
     LIMIT 1`,
    [id, includeDeleted]
  );
  return result.rows[0] || null;
}

async function listAccounts(query = {}) {
  const { search, active, page = 1, limit = 20 } = query;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;
  const where = ["a.deleted_at IS NULL"];
  const params = [];

  if (active === "true" || active === true) where.push("a.is_active = TRUE");
  else if (active === "false" || active === false) where.push("a.is_active = FALSE");

  if (search && String(search).trim()) {
    params.push(`%${String(search).trim()}%`);
    where.push(
      `(a.account_name ILIKE $${params.length} OR e.full_name ILIKE $${params.length})`
    );
  }

  const whereSql = where.join(" AND ");
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM petty_cash_accounts a
     JOIN employees e ON e.id = a.custodian_employee_id
     WHERE ${whereSql}`,
    params
  );
  const total = countResult.rows[0].total;

  params.push(limitNum, offset);
  const result = await pool.query(
    `${ACCOUNT_SELECT}
     WHERE ${whereSql}
     ORDER BY a.account_name ASC, a.id ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    items: result.rows.map(toPublicAccount),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    },
  };
}

async function getAccountById(id) {
  const row = await getAccountRow(id);
  if (!row) throw new ApiError(404, "Petty cash account not found");

  const [txns, recons] = await Promise.all([
    pool.query(
      `SELECT t.*, e.full_name AS performed_by_name
       FROM petty_cash_transactions t
       LEFT JOIN employees e ON e.id = t.performed_by
       WHERE t.account_id = $1
       ORDER BY t.txn_date DESC, t.id DESC
       LIMIT 50`,
      [id]
    ),
    pool.query(
      `SELECT r.*, e.full_name AS reconciled_by_name
       FROM petty_cash_reconciliations r
       LEFT JOIN employees e ON e.id = r.reconciled_by
       WHERE r.account_id = $1
       ORDER BY r.reconciled_on DESC, r.id DESC
       LIMIT 20`,
      [id]
    ),
  ]);

  return {
    ...toPublicAccount(row),
    transactions: txns.rows.map(toPublicTxn),
    reconciliations: recons.rows.map(toPublicReconciliation),
  };
}

async function createAccount(input, adminId) {
  await assertActiveEmployee(input.custodianEmployeeId);
  const floatAmount = input.floatAmount != null ? Number(input.floatAmount) : 0;

  const result = await pool.query(
    `INSERT INTO petty_cash_accounts (
       account_name, custodian_employee_id, float_amount, current_balance,
       is_active, notes, created_by
     ) VALUES ($1, $2, $3, $3, TRUE, $4, $5)
     RETURNING id`,
    [
      input.accountName,
      input.custodianEmployeeId,
      floatAmount,
      input.notes || null,
      adminId,
    ]
  );
  const id = result.rows[0].id;
  await writeAudit(pool, adminId, "PETTY_CASH_CREATE", id, null, {
    accountName: input.accountName,
    floatAmount,
  });
  return getAccountById(id);
}

async function updateAccount(id, input, adminId) {
  const existing = await getAccountRow(id);
  if (!existing) throw new ApiError(404, "Petty cash account not found");

  if (input.custodianEmployeeId !== undefined) {
    await assertActiveEmployee(input.custodianEmployeeId);
  }

  const columns = [];
  const values = [];
  for (const [apiKey, dbCol] of Object.entries(ACCOUNT_WRITABLE)) {
    if (!Object.prototype.hasOwnProperty.call(input, apiKey)) continue;
    let value = input[apiKey];
    if (value === "") value = null;
    columns.push(dbCol);
    values.push(value);
  }
  if (!columns.length) {
    throw new ApiError(400, "Validation failed", [
      { field: "body", message: "No updatable fields provided" },
    ]);
  }

  values.push(id);
  const result = await pool.query(
    `UPDATE petty_cash_accounts
     SET ${columns.map((c, i) => `${c} = $${i + 1}`).join(", ")},
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $${values.length} AND deleted_at IS NULL
     RETURNING id`,
    values
  );
  if (!result.rows[0]) throw new ApiError(404, "Petty cash account not found");

  await writeAudit(
    pool,
    adminId,
    "PETTY_CASH_UPDATE",
    id,
    { accountName: existing.account_name, floatAmount: Number(existing.float_amount) },
    input
  );
  return getAccountById(id);
}

async function softDeleteAccount(id, adminId) {
  const existing = await getAccountRow(id);
  if (!existing) throw new ApiError(404, "Petty cash account not found");

  await pool.query(
    `UPDATE petty_cash_accounts
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND deleted_at IS NULL`,
    [adminId, id]
  );
  await writeAudit(
    pool,
    adminId,
    "PETTY_CASH_SOFT_DELETE",
    id,
    { accountName: existing.account_name },
    null
  );
  return toPublicAccount({ ...existing, deleted_at: new Date().toISOString() });
}

async function listTransactions(accountId, query = {}) {
  const account = await getAccountRow(accountId);
  if (!account) throw new ApiError(404, "Petty cash account not found");

  const pageNum = Math.max(1, Number(query.page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (pageNum - 1) * limitNum;
  const where = ["t.account_id = $1"];
  const params = [accountId];

  if (query.txnType) {
    params.push(String(query.txnType));
    where.push(`t.txn_type = $${params.length}`);
  }

  const whereSql = where.join(" AND ");
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total FROM petty_cash_transactions t WHERE ${whereSql}`,
    params
  );
  params.push(limitNum, offset);
  const result = await pool.query(
    `SELECT t.*, e.full_name AS performed_by_name
     FROM petty_cash_transactions t
     LEFT JOIN employees e ON e.id = t.performed_by
     WHERE ${whereSql}
     ORDER BY t.txn_date DESC, t.id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    items: result.rows.map(toPublicTxn),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limitNum) || 0,
    },
  };
}

async function createTransaction(accountId, input, adminId) {
  if (input.performedBy) {
    await assertActiveEmployee(input.performedBy, "performedBy");
  }
  if (input.expenseId) {
    const exp = await pool.query(
      `SELECT id FROM expenses WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [input.expenseId]
    );
    if (!exp.rows[0]) {
      throw new ApiError(400, "Expense not found", [
        { field: "expenseId", message: "Valid expense is required" },
      ]);
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT * FROM petty_cash_accounts
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [accountId]
    );
    if (!locked.rows[0]) throw new ApiError(404, "Petty cash account not found");
    if (!locked.rows[0].is_active) {
      throw new ApiError(400, "Petty cash account is inactive");
    }

    const balance = Number(locked.rows[0].current_balance);
    const amount = Number(input.amount);
    let nextBalance = balance;
    if (input.txnType === "in") nextBalance = balance + amount;
    else nextBalance = balance - amount;

    if (nextBalance < 0) {
      throw new ApiError(400, "Insufficient petty cash balance", [
        {
          field: "amount",
          message: `Current balance is ${balance}; cannot withdraw ${amount}`,
        },
      ]);
    }

    const txn = await client.query(
      `INSERT INTO petty_cash_transactions (
         account_id, txn_type, amount, expense_id, description,
         txn_date, performed_by, created_by
       ) VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, $8)
       RETURNING *`,
      [
        accountId,
        input.txnType,
        amount,
        input.expenseId || null,
        input.description || null,
        input.txnDate || null,
        input.performedBy || null,
        adminId,
      ]
    );

    await client.query(
      `UPDATE petty_cash_accounts
       SET current_balance = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [nextBalance, accountId]
    );

    await writeAudit(client, adminId, "PETTY_CASH_TXN", accountId, { balance }, {
      txnId: Number(txn.rows[0].id),
      txnType: input.txnType,
      amount,
      nextBalance,
    });

    await client.query("COMMIT");

    let performedByName = null;
    if (txn.rows[0].performed_by) {
      const emp = await pool.query(`SELECT full_name FROM employees WHERE id = $1`, [
        txn.rows[0].performed_by,
      ]);
      performedByName = emp.rows[0]?.full_name || null;
    }

    return {
      transaction: toPublicTxn({ ...txn.rows[0], performed_by_name: performedByName }),
      account: await getAccountById(accountId),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listReconciliations(accountId, query = {}) {
  const account = await getAccountRow(accountId);
  if (!account) throw new ApiError(404, "Petty cash account not found");

  const pageNum = Math.max(1, Number(query.page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total FROM petty_cash_reconciliations WHERE account_id = $1`,
    [accountId]
  );
  const result = await pool.query(
    `SELECT r.*, e.full_name AS reconciled_by_name
     FROM petty_cash_reconciliations r
     LEFT JOIN employees e ON e.id = r.reconciled_by
     WHERE r.account_id = $1
     ORDER BY r.reconciled_on DESC, r.id DESC
     LIMIT $2 OFFSET $3`,
    [accountId, limitNum, offset]
  );

  return {
    items: result.rows.map(toPublicReconciliation),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limitNum) || 0,
    },
  };
}

async function createReconciliation(accountId, input, adminId) {
  if (input.reconciledBy) {
    await assertActiveEmployee(input.reconciledBy, "reconciledBy");
  }

  const account = await getAccountRow(accountId);
  if (!account) throw new ApiError(404, "Petty cash account not found");

  const systemBalance = Number(account.current_balance);
  const countedBalance = Number(input.countedBalance);
  const variance = countedBalance - systemBalance;

  const result = await pool.query(
    `INSERT INTO petty_cash_reconciliations (
       account_id, reconciled_on, system_balance, counted_balance,
       variance, notes, reconciled_by, created_by
     ) VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      accountId,
      input.reconciledOn || null,
      systemBalance,
      countedBalance,
      variance,
      input.notes || null,
      input.reconciledBy || null,
      adminId,
    ]
  );

  await writeAudit(pool, adminId, "PETTY_CASH_RECONCILE", accountId, null, {
    reconciliationId: Number(result.rows[0].id),
    systemBalance,
    countedBalance,
    variance,
  });

  let reconciledByName = null;
  if (result.rows[0].reconciled_by) {
    const emp = await pool.query(`SELECT full_name FROM employees WHERE id = $1`, [
      result.rows[0].reconciled_by,
    ]);
    reconciledByName = emp.rows[0]?.full_name || null;
  }

  return toPublicReconciliation({
    ...result.rows[0],
    reconciled_by_name: reconciledByName,
  });
}

module.exports = {
  listAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  softDeleteAccount,
  listTransactions,
  createTransaction,
  listReconciliations,
  createReconciliation,
};
