/**
 * Office Inventory Tracking — inventory_items + inventory_transactions.
 * Expense device purchases already sync via expense.service; this module exposes
 * list/manage/assign/return and purchase history.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  toPublicInventoryItem,
  toPublicInventoryTransaction,
  toPublicEmployee,
} = require("../utils/inventoryMapper");

async function writeAudit(clientOrPool, adminId, action, entityId, oldData, newData) {
  await clientOrPool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, 'inventory_items', $3, $4::jsonb, $5::jsonb)`,
    [
      adminId,
      action,
      entityId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
    ]
  );
}

async function getItemRow(id, { client = pool, includeDeleted = false } = {}) {
  const result = await client.query(
    `SELECT i.*, e.full_name AS assigned_to_name
     FROM inventory_items i
     LEFT JOIN employees e ON e.id = i.assigned_to
     WHERE i.id = $1
       AND ($2::boolean = TRUE OR i.deleted_at IS NULL)
     LIMIT 1`,
    [id, includeDeleted]
  );
  return result.rows[0] || null;
}

async function assertActiveEmployee(client, employeeId) {
  const result = await client.query(
    `SELECT id, full_name, is_active, deleted_at
     FROM employees WHERE id = $1 LIMIT 1`,
    [employeeId]
  );
  const row = result.rows[0];
  if (!row || row.deleted_at) {
    throw new ApiError(400, "Employee not found", [
      { field: "employeeId", message: "Valid employee is required" },
    ]);
  }
  if (!row.is_active) {
    throw new ApiError(400, "Employee is inactive", [
      { field: "employeeId", message: "Active employee is required" },
    ]);
  }
  return row;
}

async function insertTxn(client, {
  inventoryItemId,
  expenseId = null,
  txnType,
  quantityChange,
  assignedTo = null,
  notes = null,
  performedBy = null,
}) {
  await client.query(
    `INSERT INTO inventory_transactions (
       inventory_item_id, expense_id, txn_type, quantity_change,
       assigned_to, notes, performed_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      inventoryItemId,
      expenseId,
      txnType,
      quantityChange,
      assignedTo,
      notes,
      performedBy,
    ]
  );
}

async function listEmployees() {
  const result = await pool.query(
    `SELECT id, full_name, email, phone, designation, is_active
     FROM employees
     WHERE deleted_at IS NULL AND is_active = TRUE
     ORDER BY full_name ASC, id ASC`
  );
  return { items: result.rows.map(toPublicEmployee) };
}

async function listInventoryItems(query = {}) {
  const {
    status,
    search,
    assignedTo,
    page = 1,
    limit = 20,
  } = query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const where = ["i.deleted_at IS NULL"];
  const params = [];

  if (status) {
    params.push(String(status).toLowerCase());
    where.push(`i.status = $${params.length}`);
  }
  if (assignedTo) {
    params.push(Number(assignedTo));
    where.push(`i.assigned_to = $${params.length}`);
  }
  if (search && String(search).trim()) {
    const term = `%${String(search).trim()}%`;
    params.push(term, term, term);
    const i = params.length;
    where.push(
      `(i.item_name ILIKE $${i - 2}
        OR COALESCE(i.item_type, '') ILIKE $${i - 1}
        OR COALESCE(i.location_notes, '') ILIKE $${i})`
    );
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total FROM inventory_items i ${whereSql}`,
    params
  );

  const listParams = [...params, limitNum, offset];
  const listResult = await pool.query(
    `SELECT i.*, e.full_name AS assigned_to_name
     FROM inventory_items i
     LEFT JOIN employees e ON e.id = i.assigned_to
     ${whereSql}
     ORDER BY i.updated_at DESC, i.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  const total = countResult.rows[0].total;
  return {
    items: listResult.rows.map(toPublicInventoryItem),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    },
  };
}

async function getInventoryItemById(id) {
  const row = await getItemRow(id);
  if (!row) throw new ApiError(404, "Inventory item not found");
  return toPublicInventoryItem(row);
}

async function createInventoryItem(input, adminId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const quantity =
      input.quantity !== undefined && input.quantity !== null
        ? Number(input.quantity)
        : 0;
    const status = input.status || "in_stock";

    const insert = await client.query(
      `INSERT INTO inventory_items (
         item_name, item_type, quantity, unit, status,
         location_notes, purchase_date, purchase_cost, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        input.itemName,
        input.itemType || null,
        quantity,
        input.unit || "pcs",
        status,
        input.locationNotes || null,
        input.purchaseDate || null,
        input.purchaseCost !== undefined ? input.purchaseCost : null,
        input.notes || null,
      ]
    );

    const id = insert.rows[0].id;

    if (quantity > 0) {
      await insertTxn(client, {
        inventoryItemId: id,
        txnType: "purchase",
        quantityChange: quantity,
        notes: "Initial inventory registration",
        performedBy: adminId,
      });
    }

    const row = await getItemRow(id, { client });
    const publicItem = toPublicInventoryItem(row);
    await writeAudit(client, adminId, "INVENTORY_CREATE", id, null, publicItem);
    await client.query("COMMIT");
    return publicItem;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function updateInventoryItem(id, input, adminId) {
  const existing = await getItemRow(id);
  if (!existing) throw new ApiError(404, "Inventory item not found");

  if (input.status === "assigned" && !existing.assigned_to) {
    throw new ApiError(
      400,
      "Use assign endpoint to set assigned status with an employee"
    );
  }

  const fields = {
    item_name: input.itemName,
    item_type: input.itemType,
    quantity: input.quantity,
    unit: input.unit,
    status: input.status,
    location_notes: input.locationNotes,
    purchase_date: input.purchaseDate,
    purchase_cost: input.purchaseCost,
    notes: input.notes,
  };

  const sets = [];
  const values = [];
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) {
      values.push(val);
      sets.push(`${col} = $${values.length}`);
    }
  }
  if (!sets.length) {
    throw new ApiError(400, "No updatable fields provided");
  }

  // Prevent clearing assignment via generic update when status still assigned
  if (
    input.status &&
    input.status !== "assigned" &&
    existing.assigned_to &&
    input.status !== "retired" &&
    input.status !== "maintenance"
  ) {
    // allow status change away from assigned only via return for in_stock
  }

  values.push(id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE inventory_items
       SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING id`,
      values
    );
    if (!result.rows[0]) throw new ApiError(404, "Inventory item not found");

    if (input.quantity !== undefined) {
      const delta = Number(input.quantity) - Number(existing.quantity);
      if (delta !== 0) {
        await insertTxn(client, {
          inventoryItemId: id,
          txnType: "adjust",
          quantityChange: delta,
          notes: "Quantity adjusted via update",
          performedBy: adminId,
        });
      }
    }

    if (input.status === "retired" && existing.status !== "retired") {
      await insertTxn(client, {
        inventoryItemId: id,
        txnType: "retire",
        quantityChange: 0,
        notes: "Item retired",
        performedBy: adminId,
      });
      await client.query(
        `UPDATE inventory_items
         SET assigned_to = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
    }

    const row = await getItemRow(id, { client });
    const publicItem = toPublicInventoryItem(row);
    await writeAudit(
      client,
      adminId,
      "INVENTORY_UPDATE",
      id,
      toPublicInventoryItem(existing),
      publicItem
    );
    await client.query("COMMIT");
    return publicItem;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function assignInventoryItem(id, input, adminId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await getItemRow(id, { client });
    if (!existing) throw new ApiError(404, "Inventory item not found");
    if (existing.status === "retired") {
      throw new ApiError(400, "Cannot assign a retired item");
    }

    const employee = await assertActiveEmployee(client, input.employeeId);

    await client.query(
      `UPDATE inventory_items
       SET assigned_to = $1,
           status = 'assigned',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND deleted_at IS NULL`,
      [employee.id, id]
    );

    await insertTxn(client, {
      inventoryItemId: id,
      txnType: "assign",
      quantityChange: 0,
      assignedTo: employee.id,
      notes: input.notes || `Assigned to ${employee.full_name}`,
      performedBy: adminId,
    });

    const row = await getItemRow(id, { client });
    const publicItem = toPublicInventoryItem(row);
    await writeAudit(
      client,
      adminId,
      "INVENTORY_ASSIGN",
      id,
      toPublicInventoryItem(existing),
      publicItem
    );
    await client.query("COMMIT");
    return publicItem;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function returnInventoryItem(id, input, adminId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await getItemRow(id, { client });
    if (!existing) throw new ApiError(404, "Inventory item not found");
    if (!existing.assigned_to) {
      throw new ApiError(400, "Item is not currently assigned");
    }

    const previousAssignee = existing.assigned_to;

    await client.query(
      `UPDATE inventory_items
       SET assigned_to = NULL,
           status = 'in_stock',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    await insertTxn(client, {
      inventoryItemId: id,
      txnType: "return",
      quantityChange: 0,
      assignedTo: previousAssignee,
      notes: input.notes || "Returned to office stock",
      performedBy: adminId,
    });

    const row = await getItemRow(id, { client });
    const publicItem = toPublicInventoryItem(row);
    await writeAudit(
      client,
      adminId,
      "INVENTORY_RETURN",
      id,
      toPublicInventoryItem(existing),
      publicItem
    );
    await client.query("COMMIT");
    return publicItem;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function adjustInventoryQuantity(id, input, adminId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await getItemRow(id, { client });
    if (!existing) throw new ApiError(404, "Inventory item not found");

    const nextQty = Number(existing.quantity) + Number(input.quantityChange);
    if (nextQty < 0) {
      throw new ApiError(400, "Adjustment would make quantity negative");
    }

    await client.query(
      `UPDATE inventory_items
       SET quantity = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND deleted_at IS NULL`,
      [nextQty, id]
    );

    await insertTxn(client, {
      inventoryItemId: id,
      txnType: "adjust",
      quantityChange: input.quantityChange,
      notes: input.notes || "Quantity adjustment",
      performedBy: adminId,
    });

    const row = await getItemRow(id, { client });
    const publicItem = toPublicInventoryItem(row);
    await writeAudit(
      client,
      adminId,
      "INVENTORY_ADJUST",
      id,
      toPublicInventoryItem(existing),
      publicItem
    );
    await client.query("COMMIT");
    return publicItem;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listTransactions(itemId) {
  const existing = await getItemRow(itemId);
  if (!existing) throw new ApiError(404, "Inventory item not found");

  const result = await pool.query(
    `SELECT t.*,
            e.full_name AS assigned_to_name,
            a.full_name AS performed_by_name,
            ex.expense_code
     FROM inventory_transactions t
     LEFT JOIN employees e ON e.id = t.assigned_to
     LEFT JOIN admins a ON a.id = t.performed_by
     LEFT JOIN expenses ex ON ex.id = t.expense_id
     WHERE t.inventory_item_id = $1
     ORDER BY t.created_at DESC, t.id DESC`,
    [itemId]
  );

  return {
    inventoryItemId: Number(itemId),
    items: result.rows.map(toPublicInventoryTransaction),
  };
}

async function softDeleteInventoryItem(id, adminId) {
  const existing = await getItemRow(id);
  if (!existing) throw new ApiError(404, "Inventory item not found");

  const result = await pool.query(
    `UPDATE inventory_items
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [adminId, id]
  );
  if (!result.rows[0]) throw new ApiError(404, "Inventory item not found");

  await writeAudit(pool, adminId, "INVENTORY_SOFT_DELETE", id, {
    deletedAt: null,
  }, { deletedAt: result.rows[0].deleted_at });

  return {
    id: Number(result.rows[0].id),
    deletedAt: result.rows[0].deleted_at,
  };
}

module.exports = {
  listEmployees,
  listInventoryItems,
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
  assignInventoryItem,
  returnInventoryItem,
  adjustInventoryQuantity,
  listTransactions,
  softDeleteInventoryItem,
};
