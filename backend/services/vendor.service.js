/**
 * Vendor Management service — vendors, vendor_payments, vendor_documents.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  WRITABLE_FIELDS,
  toPublicVendor,
  toPublicVendorPayment,
  toPublicVendorDocument,
} = require("../utils/vendorMapper");

async function writeAudit(clientOrPool, adminId, action, entityId, oldData, newData) {
  await clientOrPool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, 'vendors', $3, $4::jsonb, $5::jsonb)`,
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

async function getVendorRow(id, { includeDeleted = false } = {}) {
  const result = await pool.query(
    `SELECT * FROM vendors
     WHERE id = $1 AND ($2::boolean = TRUE OR deleted_at IS NULL)
     LIMIT 1`,
    [id, includeDeleted]
  );
  return result.rows[0] || null;
}

async function listVendors(query = {}) {
  const { search, preferred, page = 1, limit = 20 } = query;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;
  const where = ["v.deleted_at IS NULL"];
  const params = [];

  if (preferred === "true" || preferred === true) {
    where.push("v.is_preferred = TRUE");
  }
  if (search && String(search).trim()) {
    const term = `%${String(search).trim()}%`;
    params.push(term, term, term, term);
    const i = params.length;
    where.push(
      `(v.vendor_name ILIKE $${i - 3}
        OR COALESCE(v.contact_person, '') ILIKE $${i - 2}
        OR COALESCE(v.phone, '') ILIKE $${i - 1}
        OR COALESCE(v.services, '') ILIKE $${i})`
    );
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total FROM vendors v ${whereSql}`,
    params
  );
  const listParams = [...params, limitNum, offset];
  const listResult = await pool.query(
    `SELECT v.* FROM vendors v
     ${whereSql}
     ORDER BY v.is_preferred DESC, v.vendor_name ASC, v.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );
  const total = countResult.rows[0].total;
  return {
    items: listResult.rows.map(toPublicVendor),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    },
  };
}

async function getVendorById(id) {
  const row = await getVendorRow(id);
  if (!row) throw new ApiError(404, "Vendor not found");

  const [payments, documents] = await Promise.all([
    listPayments(id),
    listDocuments(id),
  ]);

  return toPublicVendor(row, {
    payments: payments.items,
    documents: documents.items,
  });
}

async function createVendor(input, adminId) {
  const { columns, values } = buildWritableColumns(input);
  if (!columns.includes("vendor_name")) {
    columns.push("vendor_name");
    values.push(input.vendorName);
  }
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  try {
    const result = await pool.query(
      `INSERT INTO vendors (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING *`,
      values
    );
    const vendor = toPublicVendor(result.rows[0]);
    await writeAudit(pool, adminId, "VENDOR_CREATE", vendor.id, null, vendor);
    return vendor;
  } catch (err) {
    if (err.code === "23514") {
      throw new ApiError(400, err.message || "Vendor failed database checks");
    }
    throw err;
  }
}

async function updateVendor(id, input, adminId) {
  const existing = await getVendorRow(id);
  if (!existing) throw new ApiError(404, "Vendor not found");

  const { columns, values } = buildWritableColumns(input);
  if (!columns.length) throw new ApiError(400, "No updatable fields provided");

  const sets = columns.map((col, i) => `${col} = $${i + 1}`);
  values.push(id);
  try {
    const result = await pool.query(
      `UPDATE vendors
       SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    if (!result.rows[0]) throw new ApiError(404, "Vendor not found");
    const vendor = toPublicVendor(result.rows[0]);
    await writeAudit(
      pool,
      adminId,
      "VENDOR_UPDATE",
      id,
      toPublicVendor(existing),
      vendor
    );
    return vendor;
  } catch (err) {
    if (err.code === "23514") {
      throw new ApiError(400, err.message || "Vendor update failed database checks");
    }
    throw err;
  }
}

async function softDeleteVendor(id, adminId) {
  const existing = await getVendorRow(id);
  if (!existing) throw new ApiError(404, "Vendor not found");

  const result = await pool.query(
    `UPDATE vendors
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [adminId, id]
  );
  if (!result.rows[0]) throw new ApiError(404, "Vendor not found");
  await writeAudit(pool, adminId, "VENDOR_SOFT_DELETE", id, { deletedAt: null }, {
    deletedAt: result.rows[0].deleted_at,
  });
  return {
    id: Number(result.rows[0].id),
    vendorName: result.rows[0].vendor_name,
    deletedAt: result.rows[0].deleted_at,
  };
}

async function listPayments(vendorId) {
  const vendor = await getVendorRow(vendorId);
  if (!vendor) throw new ApiError(404, "Vendor not found");

  const result = await pool.query(
    `SELECT vp.*, pm.method_name AS payment_method_name
     FROM vendor_payments vp
     LEFT JOIN payment_methods pm ON pm.id = vp.payment_method_id
     WHERE vp.vendor_id = $1
     ORDER BY vp.payment_date DESC, vp.id DESC`,
    [vendorId]
  );
  return { vendorId: Number(vendorId), items: result.rows.map(toPublicVendorPayment) };
}

async function addPayment(vendorId, input, adminId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const vendorRes = await client.query(
      `SELECT * FROM vendors WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [vendorId]
    );
    if (!vendorRes.rows[0]) throw new ApiError(404, "Vendor not found");

    if (input.paymentMethodId) {
      const pm = await client.query(
        `SELECT id FROM payment_methods WHERE id = $1 AND is_active = TRUE`,
        [input.paymentMethodId]
      );
      if (!pm.rows[0]) {
        throw new ApiError(400, "Payment method not found", [
          { field: "paymentMethodId", message: "Valid payment method required" },
        ]);
      }
    }

    const amount = Number(input.amount);
    const insert = await client.query(
      `INSERT INTO vendor_payments
         (vendor_id, amount, payment_date, payment_method_id, reference_number, notes, created_by)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5, $6, $7)
       RETURNING *`,
      [
        vendorId,
        amount,
        input.paymentDate || null,
        input.paymentMethodId || null,
        input.referenceNumber || null,
        input.notes || null,
        adminId,
      ]
    );

    const current = Number(vendorRes.rows[0].outstanding_balance);
    const nextBalance = Math.max(0, Math.round((current - amount) * 100) / 100);
    await client.query(
      `UPDATE vendors
       SET outstanding_balance = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [nextBalance, vendorId]
    );

    await writeAudit(client, adminId, "VENDOR_PAYMENT_CREATE", insert.rows[0].id, null, {
      vendorId,
      amount,
      outstandingBalance: nextBalance,
    });

    await client.query("COMMIT");
    const payment = toPublicVendorPayment(insert.rows[0]);
    return { payment, outstandingBalance: nextBalance };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listDocuments(vendorId) {
  const vendor = await getVendorRow(vendorId);
  if (!vendor) throw new ApiError(404, "Vendor not found");

  const result = await pool.query(
    `SELECT * FROM vendor_documents
     WHERE vendor_id = $1 AND deleted_at IS NULL
     ORDER BY upload_date DESC, id DESC`,
    [vendorId]
  );
  return {
    vendorId: Number(vendorId),
    items: result.rows.map(toPublicVendorDocument),
  };
}

async function addDocument(vendorId, input, adminId) {
  const vendor = await getVendorRow(vendorId);
  if (!vendor) throw new ApiError(404, "Vendor not found");

  const result = await pool.query(
    `INSERT INTO vendor_documents
       (vendor_id, document_name, document_type, file_path, file_name, mime_type, expiry_date, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      vendorId,
      input.documentName || null,
      input.documentType || null,
      input.filePath,
      input.fileName || null,
      input.mimeType || null,
      input.expiryDate || null,
      adminId,
    ]
  );
  const doc = toPublicVendorDocument(result.rows[0]);
  await writeAudit(pool, adminId, "VENDOR_DOCUMENT_CREATE", doc.id, null, doc);
  return doc;
}

async function softDeleteDocument(vendorId, documentId, adminId) {
  const vendor = await getVendorRow(vendorId);
  if (!vendor) throw new ApiError(404, "Vendor not found");

  const result = await pool.query(
    `UPDATE vendor_documents
     SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1
     WHERE id = $2 AND vendor_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [adminId, documentId, vendorId]
  );
  if (!result.rows[0]) throw new ApiError(404, "Vendor document not found");
  return {
    id: Number(result.rows[0].id),
    deletedAt: result.rows[0].deleted_at,
  };
}

module.exports = {
  listVendors,
  getVendorById,
  createVendor,
  updateVendor,
  softDeleteVendor,
  listPayments,
  addPayment,
  listDocuments,
  addDocument,
  softDeleteDocument,
};
