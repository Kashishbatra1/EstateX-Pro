/**
 * Expense Management service — approved schema only.
 * Device/item purchases sync inventory_items + inventory_transactions (core business rule).
 * Does not implement full Inventory / Vendor / Recurring modules.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  ALLOWED_APPROVAL_TRANSITIONS,
  EXPENSE_WRITABLE_FIELDS,
  toPublicExpense,
} = require("../utils/expenseMapper");

const EXPENSE_SELECT = `
  SELECT e.*,
         cat.category_name,
         sub.subcategory_name,
         v.vendor_name,
         pm.method_name AS payment_method_name,
         emp.full_name AS paid_by_employee_name,
         p.property_code
  FROM expenses e
  JOIN expense_categories cat ON cat.id = e.category_id
  LEFT JOIN expense_subcategories sub ON sub.id = e.subcategory_id
  LEFT JOIN vendors v ON v.id = e.vendor_id
  LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
  JOIN employees emp ON emp.id = e.paid_by_employee_id
  LEFT JOIN properties p ON p.id = e.property_id
`;

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

async function writeAudit(clientOrPool, adminId, action, entityId, oldData, newData) {
  await clientOrPool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, 'expense', $3, $4::jsonb, $5::jsonb)`,
    [
      adminId || null,
      action,
      entityId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
    ]
  );
}

async function generateExpenseCode(client) {
  const year = new Date().getFullYear();
  const result = await client.query(
    `SELECT COALESCE(
       MAX(NULLIF(regexp_replace(expense_code, '^EX-' || $1 || '-', ''), expense_code)::INT),
       0
     ) + 1 AS next_num
     FROM expenses
     WHERE expense_code ~ ('^EX-' || $1 || '-[0-9]+$')`,
    [String(year)]
  );
  const next = Number(result.rows[0].next_num) || 1;
  return `EX-${year}-${String(next).padStart(4, "0")}`;
}

async function getExpenseRow(id, { includeDeleted = false, client = pool } = {}) {
  const result = await client.query(
    `${EXPENSE_SELECT}
     WHERE e.id = $1
       AND ($2::boolean = TRUE OR e.deleted_at IS NULL)
     LIMIT 1`,
    [id, includeDeleted]
  );
  return result.rows[0] || null;
}

async function assertCategory(client, categoryId) {
  const result = await client.query(
    `SELECT id, category_name, is_active FROM expense_categories WHERE id = $1 LIMIT 1`,
    [categoryId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new ApiError(400, "Expense category not found", [
      { field: "categoryId", message: "Valid category is required" },
    ]);
  }
  if (!row.is_active) {
    throw new ApiError(400, "Expense category is inactive", [
      { field: "categoryId", message: "Select an active category" },
    ]);
  }
  return row;
}

async function assertSubcategory(client, subcategoryId, categoryId) {
  if (!subcategoryId) return null;
  const result = await client.query(
    `SELECT id, category_id, subcategory_name, is_active
     FROM expense_subcategories WHERE id = $1 LIMIT 1`,
    [subcategoryId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new ApiError(400, "Expense subcategory not found", [
      { field: "subcategoryId", message: "Valid subcategory is required" },
    ]);
  }
  if (Number(row.category_id) !== Number(categoryId)) {
    throw new ApiError(400, "Subcategory does not belong to the selected category", [
      { field: "subcategoryId", message: "Subcategory must match category" },
    ]);
  }
  if (!row.is_active) {
    throw new ApiError(400, "Expense subcategory is inactive", [
      { field: "subcategoryId", message: "Select an active subcategory" },
    ]);
  }
  return row;
}

async function assertEmployee(client, employeeId) {
  const result = await client.query(
    `SELECT id, full_name, is_active, deleted_at FROM employees WHERE id = $1 LIMIT 1`,
    [employeeId]
  );
  const row = result.rows[0];
  if (!row || row.deleted_at) {
    throw new ApiError(400, "Employee (paidBy) not found", [
      { field: "paidByEmployeeId", message: "Valid employee is required" },
    ]);
  }
  if (!row.is_active) {
    throw new ApiError(400, "Employee is inactive", [
      { field: "paidByEmployeeId", message: "Select an active employee" },
    ]);
  }
  return row;
}

async function assertVendor(client, vendorId) {
  if (!vendorId) return null;
  const result = await client.query(
    `SELECT id, vendor_name, deleted_at FROM vendors WHERE id = $1 LIMIT 1`,
    [vendorId]
  );
  const row = result.rows[0];
  if (!row || row.deleted_at) {
    throw new ApiError(400, "Vendor not found or deleted", [
      { field: "vendorId", message: "Valid vendor is required" },
    ]);
  }
  return row;
}

async function assertPaymentMethod(client, paymentMethodId) {
  if (!paymentMethodId) return null;
  const result = await client.query(
    `SELECT id, method_name, is_active FROM payment_methods WHERE id = $1 LIMIT 1`,
    [paymentMethodId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new ApiError(400, "Payment method not found", [
      { field: "paymentMethodId", message: "Valid payment method is required" },
    ]);
  }
  if (!row.is_active) {
    throw new ApiError(400, "Payment method is inactive", [
      { field: "paymentMethodId", message: "Select an active payment method" },
    ]);
  }
  return row;
}

async function assertProperty(client, propertyId) {
  if (!propertyId) return null;
  const result = await client.query(
    `SELECT id, property_code, deleted_at FROM properties WHERE id = $1 LIMIT 1`,
    [propertyId]
  );
  const row = result.rows[0];
  if (!row || row.deleted_at) {
    throw new ApiError(400, "Property not found or deleted", [
      { field: "propertyId", message: "Valid property is required" },
    ]);
  }
  return row;
}

/**
 * Core rule: device/item purchase must update office inventory tracking.
 */
async function syncDeviceInventory(client, expense, adminId) {
  if (!expense.device_or_item_name) return null;
  const qty = Number(expense.quantity);
  if (!qty || qty <= 0) {
    throw new ApiError(400, "Device/item expense requires a positive quantity");
  }

  let inventoryItemId = expense.inventory_item_id ? Number(expense.inventory_item_id) : null;

  if (inventoryItemId) {
    const existing = await client.query(
      `SELECT id, quantity, deleted_at FROM inventory_items WHERE id = $1 FOR UPDATE`,
      [inventoryItemId]
    );
    if (!existing.rows[0] || existing.rows[0].deleted_at) {
      throw new ApiError(400, "Linked inventory item not found");
    }
    await client.query(
      `UPDATE inventory_items
       SET quantity = quantity + $1,
           purchase_cost = COALESCE(purchase_cost, $2),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [qty, expense.amount, inventoryItemId]
    );
  } else {
    const created = await client.query(
      `INSERT INTO inventory_items (
         item_name, item_type, quantity, unit, status,
         purchase_date, purchase_cost, notes
       ) VALUES ($1, $2, $3, 'pcs', 'in_stock', $4, $5, $6)
       RETURNING id`,
      [
        expense.device_or_item_name,
        "Device",
        qty,
        expense.expense_date,
        expense.amount,
        `Created from expense ${expense.expense_code}`,
      ]
    );
    inventoryItemId = created.rows[0].id;
    await client.query(
      `UPDATE expenses SET inventory_item_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [inventoryItemId, expense.id]
    );
  }

  await client.query(
    `INSERT INTO inventory_transactions (
       inventory_item_id, expense_id, txn_type, quantity_change, notes, performed_by
     ) VALUES ($1, $2, 'purchase', $3, $4, $5)`,
    [
      inventoryItemId,
      expense.id,
      qty,
      `Purchase via expense ${expense.expense_code}`,
      adminId || null,
    ]
  );

  return inventoryItemId;
}

async function createExpense(input, adminId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await assertCategory(client, input.categoryId);
    await assertSubcategory(client, input.subcategoryId || null, input.categoryId);
    await assertEmployee(client, input.paidByEmployeeId);
    await assertVendor(client, input.vendorId || null);
    await assertPaymentMethod(client, input.paymentMethodId || null);
    await assertProperty(client, input.propertyId || null);

    const amount = roundMoney(input.amount);
    if (amount <= 0) throw new ApiError(400, "Expense amount must be greater than zero");

    const gst = roundMoney(input.gstSalesTax !== undefined ? input.gstSalesTax : 0);
    const remaining = roundMoney(
      input.remainingAmount !== undefined ? input.remainingAmount : 0
    );
    if (remaining > amount) {
      throw new ApiError(400, "Remaining amount cannot exceed expense amount");
    }

    const expenseCode = await generateExpenseCode(client);
    const expenseDate = input.expenseDate || new Date().toISOString().slice(0, 10);

    const insert = await client.query(
      `INSERT INTO expenses (
         expense_code, expense_date, category_id, subcategory_id, vendor_id,
         amount, gst_sales_tax, remaining_amount, payment_method_id,
         description, paid_by_employee_id, device_or_item_name, quantity,
         receipt_path, reimbursement_status, approval_status, property_id, created_by
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10, $11, $12, $13,
         $14, $15, 'requested', $16, $17
       )
       RETURNING *`,
      [
        expenseCode,
        expenseDate,
        input.categoryId,
        input.subcategoryId || null,
        input.vendorId || null,
        amount,
        gst,
        remaining,
        input.paymentMethodId || null,
        input.description || null,
        input.paidByEmployeeId,
        input.deviceOrItemName || null,
        input.quantity !== undefined ? input.quantity : null,
        input.receiptPath || null,
        input.reimbursementStatus || "none",
        input.propertyId || null,
        adminId || null,
      ]
    );

    let row = insert.rows[0];

    // Inventory sync for device/item purchases (core rule)
    if (row.device_or_item_name) {
      const invId = await syncDeviceInventory(client, row, adminId);
      row = (await client.query(`SELECT * FROM expenses WHERE id = $1`, [row.id])).rows[0];
      row.inventory_item_id = invId;
    }

    await writeAudit(client, adminId, "EXPENSE_CREATE", row.id, null, {
      expenseCode,
      amount,
      categoryId: input.categoryId,
      paidByEmployeeId: input.paidByEmployeeId,
      approvalStatus: "requested",
      inventoryItemId: row.inventory_item_id || null,
    });

    await client.query("COMMIT");
    return toPublicExpense(await getExpenseRow(row.id));
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof ApiError) throw err;
    if (err.code === "23505") throw new ApiError(409, "Expense code conflict; please retry");
    if (err.code === "23514") {
      throw new ApiError(400, err.message || "Expense failed database checks");
    }
    if (err.code === "23503") {
      throw new ApiError(400, "Related record not found for expense");
    }
    throw err;
  } finally {
    client.release();
  }
}

async function listExpenses(query = {}) {
  const {
    search,
    categoryId,
    subcategoryId,
    vendorId,
    propertyId,
    paidByEmployeeId,
    paymentMethodId,
    approvalStatus,
    reimbursementStatus,
    expenseFrom,
    expenseTo,
    page = 1,
    limit = 20,
  } = query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const where = ["e.deleted_at IS NULL"];
  const params = [];

  function add(sql, value) {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  }

  if (categoryId) add("e.category_id = ?", Number(categoryId));
  if (subcategoryId) add("e.subcategory_id = ?", Number(subcategoryId));
  if (vendorId) add("e.vendor_id = ?", Number(vendorId));
  if (propertyId) add("e.property_id = ?", Number(propertyId));
  if (paidByEmployeeId) add("e.paid_by_employee_id = ?", Number(paidByEmployeeId));
  if (paymentMethodId) add("e.payment_method_id = ?", Number(paymentMethodId));
  if (approvalStatus) add("e.approval_status = ?", String(approvalStatus).toLowerCase());
  if (reimbursementStatus) {
    add("e.reimbursement_status = ?", String(reimbursementStatus).toLowerCase());
  }
  if (expenseFrom) add("e.expense_date >= ?", expenseFrom);
  if (expenseTo) add("e.expense_date <= ?", expenseTo);

  if (search && String(search).trim()) {
    const term = `%${String(search).trim()}%`;
    params.push(term, term, term, term);
    const i = params.length;
    where.push(
      `(e.expense_code ILIKE $${i - 3}
        OR CAST(e.id AS TEXT) ILIKE $${i - 2}
        OR COALESCE(e.description, '') ILIKE $${i - 1}
        OR COALESCE(e.device_or_item_name, '') ILIKE $${i})`
    );
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total FROM expenses e ${whereSql}`,
    params
  );

  const listParams = [...params, limitNum, offset];
  const listResult = await pool.query(
    `${EXPENSE_SELECT}
     ${whereSql}
     ORDER BY e.expense_date DESC, e.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  return {
    items: listResult.rows.map((row) => toPublicExpense(row)),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limitNum) || 0,
    },
  };
}

async function getExpenseById(id) {
  const row = await getExpenseRow(id);
  if (!row) throw new ApiError(404, "Expense not found");
  return toPublicExpense(row);
}

async function updateExpense(id, input, adminId) {
  const existing = await getExpenseRow(id);
  if (!existing) throw new ApiError(404, "Expense not found");

  if (existing.approval_status === "approved" || existing.approval_status === "rejected") {
    throw new ApiError(400, `Cannot update a ${existing.approval_status} expense`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const locked = await client.query(
      `SELECT * FROM expenses WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [id]
    );
    if (!locked.rows[0]) throw new ApiError(404, "Expense not found");
    const current = locked.rows[0];

    const nextCategoryId =
      input.categoryId !== undefined ? Number(input.categoryId) : Number(current.category_id);
    const nextSubcategoryId =
      input.subcategoryId !== undefined
        ? input.subcategoryId === null || input.subcategoryId === ""
          ? null
          : Number(input.subcategoryId)
        : current.subcategory_id;

    if (input.categoryId !== undefined || input.subcategoryId !== undefined) {
      await assertCategory(client, nextCategoryId);
      await assertSubcategory(client, nextSubcategoryId, nextCategoryId);
    }
    if (input.paidByEmployeeId !== undefined) {
      await assertEmployee(client, Number(input.paidByEmployeeId));
    }
    if (input.vendorId !== undefined) {
      await assertVendor(
        client,
        input.vendorId === null || input.vendorId === "" ? null : Number(input.vendorId)
      );
    }
    if (input.paymentMethodId !== undefined) {
      await assertPaymentMethod(
        client,
        input.paymentMethodId === null || input.paymentMethodId === ""
          ? null
          : Number(input.paymentMethodId)
      );
    }
    if (input.propertyId !== undefined) {
      await assertProperty(
        client,
        input.propertyId === null || input.propertyId === "" ? null : Number(input.propertyId)
      );
    }

    const nextAmount =
      input.amount !== undefined ? roundMoney(input.amount) : Number(current.amount);
    if (nextAmount <= 0) throw new ApiError(400, "Expense amount must be greater than zero");

    const nextRemaining =
      input.remainingAmount !== undefined
        ? roundMoney(input.remainingAmount)
        : Number(current.remaining_amount);
    if (nextRemaining > nextAmount) {
      throw new ApiError(400, "Remaining amount cannot exceed expense amount");
    }

    const sets = [];
    const values = [];
    const touched = {};

    function setCol(dbCol, value) {
      values.push(value === "" ? null : value);
      sets.push(`${dbCol} = $${values.length}`);
    }

    if (input.amount !== undefined) {
      setCol("amount", nextAmount);
      touched.amount = nextAmount;
    }
    if (input.remainingAmount !== undefined || input.amount !== undefined) {
      setCol("remaining_amount", nextRemaining);
      touched.remainingAmount = nextRemaining;
    }

    for (const [apiKey, dbCol] of Object.entries(EXPENSE_WRITABLE_FIELDS)) {
      if (!Object.prototype.hasOwnProperty.call(input, apiKey)) continue;
      if (apiKey === "amount" || apiKey === "remainingAmount") continue;

      let value = input[apiKey];
      if (value === "") value = null;
      if (["categoryId", "subcategoryId", "vendorId", "paymentMethodId", "paidByEmployeeId", "propertyId"].includes(apiKey)) {
        value = value === null ? null : Number(value);
      }
      if (apiKey === "gstSalesTax" || apiKey === "quantity") {
        value = value === null ? null : Number(value);
      }
      setCol(dbCol, value);
      touched[apiKey] = value;
    }

    if (!sets.length) throw new ApiError(400, "No updatable fields provided");

    values.push(id);
    const result = await client.query(
      `UPDATE expenses
       SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    if (!result.rows[0]) throw new ApiError(404, "Expense not found");

    // If device fields newly set and no inventory yet, sync now
    const updated = result.rows[0];
    if (updated.device_or_item_name && !updated.inventory_item_id) {
      await syncDeviceInventory(client, updated, adminId);
    }

    await writeAudit(
      client,
      adminId,
      "EXPENSE_UPDATE",
      id,
      {
        amount: Number(current.amount),
        remainingAmount: Number(current.remaining_amount),
        description: current.description,
      },
      touched
    );

    await client.query("COMMIT");
    return getExpenseById(id);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof ApiError) throw err;
    if (err.code === "23514") {
      throw new ApiError(400, err.message || "Expense update failed database checks");
    }
    throw err;
  } finally {
    client.release();
  }
}

async function changeApprovalStatus(id, input, adminId) {
  const newStatus = String(input.approvalStatus).toLowerCase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const locked = await client.query(
      `SELECT * FROM expenses WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [id]
    );
    if (!locked.rows[0]) throw new ApiError(404, "Expense not found");
    const existing = locked.rows[0];

    if (existing.approval_status === newStatus) {
      await client.query("COMMIT");
      return getExpenseById(id);
    }

    const allowed = ALLOWED_APPROVAL_TRANSITIONS[existing.approval_status] || [];
    if (!allowed.includes(newStatus)) {
      throw new ApiError(
        400,
        `Invalid approval transition from ${existing.approval_status} to ${newStatus}`,
        { allowedTransitions: allowed }
      );
    }

    if (newStatus === "rejected" && !(input.rejectionReason || "").trim()) {
      throw new ApiError(400, "Rejection reason is required");
    }

    const result = await client.query(
      `UPDATE expenses
       SET approval_status = $1,
           approved_by = $2,
           approved_at = CURRENT_TIMESTAMP,
           rejection_reason = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING *`,
      [
        newStatus,
        adminId || null,
        newStatus === "rejected" ? input.rejectionReason.trim() : null,
        id,
      ]
    );

    await writeAudit(
      client,
      adminId,
      `EXPENSE_${newStatus.toUpperCase()}`,
      id,
      { approvalStatus: existing.approval_status },
      {
        approvalStatus: newStatus,
        rejectionReason: newStatus === "rejected" ? input.rejectionReason : null,
      }
    );

    await client.query("COMMIT");
    return toPublicExpense(await getExpenseRow(result.rows[0].id));
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof ApiError) throw err;
    if (err.code === "23514") {
      throw new ApiError(400, err.message || "Approval change rejected by database rules");
    }
    throw err;
  } finally {
    client.release();
  }
}

async function softDeleteExpense(id, adminId) {
  const existing = await getExpenseRow(id);
  if (!existing) throw new ApiError(404, "Expense not found");

  const result = await pool.query(
    `UPDATE expenses
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [adminId, id]
  );
  if (!result.rows[0]) throw new ApiError(404, "Expense not found");

  await writeAudit(pool, adminId, "EXPENSE_SOFT_DELETE", id, { deletedAt: null }, {
    deletedAt: result.rows[0].deleted_at,
  });

  return toPublicExpense(await getExpenseRow(id, { includeDeleted: true }));
}

module.exports = {
  createExpense,
  listExpenses,
  getExpenseById,
  updateExpense,
  changeApprovalStatus,
  softDeleteExpense,
};
