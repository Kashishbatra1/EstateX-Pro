/**
 * Bank Accounts & Payment Methods service — approved schema only.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  BANK_WRITABLE_FIELDS,
  toPublicBankAccount,
  toPublicPaymentMethod,
  toPublicPropertyBankLink,
} = require("../utils/bankMapper");

async function getBankRow(id, { includeDeleted = false } = {}) {
  const result = await pool.query(
    `SELECT * FROM bank_accounts
     WHERE id = $1
       AND ($2::boolean = TRUE OR deleted_at IS NULL)
     LIMIT 1`,
    [id, includeDeleted]
  );
  return result.rows[0] || null;
}

async function getPropertyRow(propertyId) {
  const result = await pool.query(
    `SELECT id, property_code, title, status, deleted_at
     FROM properties
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [propertyId]
  );
  return result.rows[0] || null;
}

function buildBankColumns(input) {
  const columns = [];
  const values = [];
  for (const [apiKey, dbCol] of Object.entries(BANK_WRITABLE_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(input, apiKey)) {
      let value = input[apiKey];
      if (value === "") value = null;
      columns.push(dbCol);
      values.push(value);
    }
  }
  return { columns, values };
}

/* ----------------------------- Payment Methods ----------------------------- */

async function listPaymentMethods(query = {}) {
  const params = [];
  const where = [];
  if (query.activeOnly === "true" || query.activeOnly === true) {
    where.push("is_active = TRUE");
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const result = await pool.query(
    `SELECT * FROM payment_methods ${whereSql} ORDER BY id ASC`,
    params
  );
  return { items: result.rows.map(toPublicPaymentMethod) };
}

async function getPaymentMethodById(id) {
  const result = await pool.query(
    `SELECT * FROM payment_methods WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!result.rows[0]) throw new ApiError(404, "Payment method not found");
  return toPublicPaymentMethod(result.rows[0]);
}

async function createPaymentMethod(input) {
  try {
    const result = await pool.query(
      `INSERT INTO payment_methods (method_name, is_active)
       VALUES ($1, COALESCE($2, TRUE))
       RETURNING *`,
      [input.methodName, input.isActive]
    );
    return toPublicPaymentMethod(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      throw new ApiError(409, "A payment method with this name already exists");
    }
    throw err;
  }
}

async function updatePaymentMethod(id, input) {
  const sets = [];
  const params = [];
  if (input.methodName !== undefined) {
    params.push(input.methodName);
    sets.push(`method_name = $${params.length}`);
  }
  if (input.isActive !== undefined) {
    params.push(input.isActive);
    sets.push(`is_active = $${params.length}`);
  }
  if (!sets.length) throw new ApiError(400, "No updatable fields provided");

  params.push(id);
  try {
    const result = await pool.query(
      `UPDATE payment_methods
       SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );
    if (!result.rows[0]) throw new ApiError(404, "Payment method not found");
    return toPublicPaymentMethod(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      throw new ApiError(409, "A payment method with this name already exists");
    }
    throw err;
  }
}

/* ------------------------------ Bank Accounts ------------------------------ */

async function createBankAccount(input) {
  const { columns, values } = buildBankColumns(input);
  for (const [col, val] of Object.entries({
    bank_name: input.bankName,
    account_holder_name: input.accountHolderName,
    account_number: input.accountNumber,
  })) {
    if (!columns.includes(col)) {
      columns.push(col);
      values.push(val);
    }
  }
  if (!columns.includes("is_active")) {
    columns.push("is_active");
    values.push(input.isActive !== undefined ? input.isActive : true);
  }

  const placeholders = columns.map((_, i) => `$${i + 1}`);
  try {
    const result = await pool.query(
      `INSERT INTO bank_accounts (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING *`,
      values
    );
    return toPublicBankAccount(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      throw new ApiError(409, "This bank account number already exists for that bank");
    }
    throw err;
  }
}

async function listBankAccounts(query = {}) {
  const {
    search,
    isActive,
    page = 1,
    limit = 20,
  } = query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const where = ["ba.deleted_at IS NULL"];
  const params = [];

  function add(sql, value) {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  }

  if (isActive === "true" || isActive === true) add("ba.is_active = ?", true);
  if (isActive === "false" || isActive === false) add("ba.is_active = ?", false);

  if (search && String(search).trim()) {
    const term = `%${String(search).trim()}%`;
    params.push(term, term, term, term);
    const i = params.length;
    where.push(
      `(ba.bank_name ILIKE $${i - 3}
        OR ba.account_holder_name ILIKE $${i - 2}
        OR ba.account_number ILIKE $${i - 1}
        OR COALESCE(ba.iban, '') ILIKE $${i})`
    );
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total FROM bank_accounts ba ${whereSql}`,
    params
  );
  const listParams = [...params, limitNum, offset];
  const listResult = await pool.query(
    `SELECT ba.* FROM bank_accounts ba
     ${whereSql}
     ORDER BY ba.created_at DESC, ba.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  return {
    items: listResult.rows.map((row) => toPublicBankAccount(row)),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limitNum) || 0,
    },
  };
}

async function getBankAccountById(id) {
  const row = await getBankRow(id);
  if (!row) throw new ApiError(404, "Bank account not found");

  const links = await pool.query(
    `SELECT pba.*, p.property_code, p.title AS property_title, p.status AS property_status
     FROM property_bank_accounts pba
     JOIN properties p ON p.id = pba.property_id
     WHERE pba.bank_account_id = $1 AND p.deleted_at IS NULL
     ORDER BY pba.created_at DESC`,
    [id]
  );

  return toPublicBankAccount(row, {
    properties: links.rows.map((r) => ({
      linkId: Number(r.id),
      propertyId: Number(r.property_id),
      propertyCode: r.property_code,
      propertyTitle: r.property_title,
      propertyStatus: r.property_status,
      isPrimary: r.is_primary,
    })),
  });
}

async function updateBankAccount(id, input) {
  const existing = await getBankRow(id);
  if (!existing) throw new ApiError(404, "Bank account not found");

  const { columns, values } = buildBankColumns(input);
  if (!columns.length) throw new ApiError(400, "No updatable fields provided");

  const sets = columns.map((col, i) => `${col} = $${i + 1}`);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE bank_accounts
       SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    if (!result.rows[0]) throw new ApiError(404, "Bank account not found");
    return toPublicBankAccount(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      throw new ApiError(409, "This bank account number already exists for that bank");
    }
    if (err.code === "23514" || err.code === "P0001") {
      throw new ApiError(
        400,
        err.message || "Cannot update bank account required by a listed property"
      );
    }
    throw err;
  }
}

async function softDeleteBankAccount(id, adminId) {
  const existing = await getBankRow(id);
  if (!existing) throw new ApiError(404, "Bank account not found");

  try {
    const result = await pool.query(
      `UPDATE bank_accounts
       SET deleted_at = CURRENT_TIMESTAMP,
           deleted_by = $1,
           is_active = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [adminId, id]
    );
    if (!result.rows[0]) throw new ApiError(404, "Bank account not found");
    return {
      id: Number(result.rows[0].id),
      bankName: result.rows[0].bank_name,
      accountNumber: result.rows[0].account_number,
      deletedAt: result.rows[0].deleted_at,
    };
  } catch (err) {
    if (err.code === "23514" || err.code === "P0001") {
      throw new ApiError(
        400,
        err.message || "Cannot delete bank account required by a listed property"
      );
    }
    throw err;
  }
}

/* ------------------------ Property ↔ Bank linking ------------------------- */

async function listPropertyBankAccounts(propertyId) {
  const property = await getPropertyRow(propertyId);
  if (!property) throw new ApiError(404, "Property not found");

  const result = await pool.query(
    `SELECT pba.*, ba.bank_name, ba.account_holder_name, ba.account_number, ba.is_active
     FROM property_bank_accounts pba
     JOIN bank_accounts ba ON ba.id = pba.bank_account_id
     WHERE pba.property_id = $1
     ORDER BY pba.is_primary DESC, pba.id ASC`,
    [propertyId]
  );

  return {
    property: {
      id: Number(property.id),
      propertyCode: property.property_code,
      title: property.title,
      status: property.status,
    },
    bankAccounts: result.rows.map(toPublicPropertyBankLink),
  };
}

async function linkBankAccountToProperty(propertyId, input, adminId) {
  const property = await getPropertyRow(propertyId);
  if (!property) throw new ApiError(404, "Property not found");

  const bank = await getBankRow(input.bankAccountId);
  if (!bank) throw new ApiError(404, "Bank account not found");
  if (!bank.is_active) {
    throw new ApiError(400, "Cannot link an inactive bank account");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (input.isPrimary) {
      await client.query(
        `UPDATE property_bank_accounts SET is_primary = FALSE WHERE property_id = $1`,
        [propertyId]
      );
    }

    const insert = await client.query(
      `INSERT INTO property_bank_accounts (property_id, bank_account_id, is_primary)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [propertyId, input.bankAccountId, Boolean(input.isPrimary)]
    );

    await client.query(
      `INSERT INTO property_history
         (property_id, event_type, new_value, description, performed_by)
       VALUES ($1, 'other', $2::jsonb, $3, $4)`,
      [
        propertyId,
        JSON.stringify({
          action: "bank_link",
          bankAccountId: input.bankAccountId,
          bankName: bank.bank_name,
          accountNumber: bank.account_number,
          isPrimary: Boolean(input.isPrimary),
        }),
        "Bank account linked to property",
        adminId,
      ]
    );

    await client.query("COMMIT");

    return toPublicPropertyBankLink({
      ...insert.rows[0],
      bank_name: bank.bank_name,
      account_holder_name: bank.account_holder_name,
      account_number: bank.account_number,
      is_active: bank.is_active,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      throw new ApiError(409, "This bank account is already linked to the property");
    }
    if (err.code === "23514" || err.code === "P0001") {
      throw new ApiError(400, err.message || "Bank link rejected by database rules");
    }
    throw err;
  } finally {
    client.release();
  }
}

async function updatePropertyBankLink(propertyId, bankAccountId, input, adminId) {
  const property = await getPropertyRow(propertyId);
  if (!property) throw new ApiError(404, "Property not found");

  const existing = await pool.query(
    `SELECT pba.*, ba.bank_name, ba.account_holder_name, ba.account_number, ba.is_active
     FROM property_bank_accounts pba
     JOIN bank_accounts ba ON ba.id = pba.bank_account_id
     WHERE pba.property_id = $1 AND pba.bank_account_id = $2
     LIMIT 1`,
    [propertyId, bankAccountId]
  );
  if (!existing.rows[0]) {
    throw new ApiError(404, "Bank account is not linked to this property");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (input.isPrimary === true) {
      await client.query(
        `UPDATE property_bank_accounts SET is_primary = FALSE WHERE property_id = $1`,
        [propertyId]
      );
    }

    const updated = await client.query(
      `UPDATE property_bank_accounts
       SET is_primary = COALESCE($1, is_primary)
       WHERE property_id = $2 AND bank_account_id = $3
       RETURNING *`,
      [input.isPrimary === undefined ? null : Boolean(input.isPrimary), propertyId, bankAccountId]
    );

    await client.query(
      `INSERT INTO property_history
         (property_id, event_type, old_value, new_value, description, performed_by)
       VALUES ($1, 'other', $2::jsonb, $3::jsonb, $4, $5)`,
      [
        propertyId,
        JSON.stringify({ bankAccountId, isPrimary: existing.rows[0].is_primary }),
        JSON.stringify({ bankAccountId, isPrimary: updated.rows[0].is_primary }),
        "Property bank account link updated",
        adminId,
      ]
    );

    await client.query("COMMIT");

    const row = existing.rows[0];
    return toPublicPropertyBankLink({
      ...updated.rows[0],
      bank_name: row.bank_name,
      account_holder_name: row.account_holder_name,
      account_number: row.account_number,
      is_active: row.is_active,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function unlinkBankAccountFromProperty(propertyId, bankAccountId, adminId) {
  const property = await getPropertyRow(propertyId);
  if (!property) throw new ApiError(404, "Property not found");

  const existing = await pool.query(
    `SELECT pba.*, ba.bank_name, ba.account_number
     FROM property_bank_accounts pba
     JOIN bank_accounts ba ON ba.id = pba.bank_account_id
     WHERE pba.property_id = $1 AND pba.bank_account_id = $2
     LIMIT 1`,
    [propertyId, bankAccountId]
  );
  if (!existing.rows[0]) {
    throw new ApiError(404, "Bank account is not linked to this property");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM property_bank_accounts
       WHERE property_id = $1 AND bank_account_id = $2`,
      [propertyId, bankAccountId]
    );

    await client.query(
      `INSERT INTO property_history
         (property_id, event_type, old_value, new_value, description, performed_by)
       VALUES ($1, 'other', $2::jsonb, $3::jsonb, $4, $5)`,
      [
        propertyId,
        JSON.stringify({
          action: "bank_unlink",
          bankAccountId,
          bankName: existing.rows[0].bank_name,
          accountNumber: existing.rows[0].account_number,
        }),
        JSON.stringify({ action: "unlinked", bankAccountId }),
        "Bank account unlinked from property",
        adminId,
      ]
    );

    await client.query("COMMIT");
    return { propertyId, bankAccountId, unlinked: true };
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23514" || err.code === "P0001") {
      throw new ApiError(
        400,
        err.message || "Cannot unlink the only bank account from a listed property"
      );
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listPaymentMethods,
  getPaymentMethodById,
  createPaymentMethod,
  updatePaymentMethod,
  createBankAccount,
  listBankAccounts,
  getBankAccountById,
  updateBankAccount,
  softDeleteBankAccount,
  listPropertyBankAccounts,
  linkBankAccountToProperty,
  updatePropertyBankLink,
  unlinkBankAccountFromProperty,
};
