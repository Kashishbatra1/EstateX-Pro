/**
 * Client Management / CRM service — approved schema only.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  CLIENT_WRITABLE_FIELDS,
  toPublicClient,
  toPublicCommunication,
  toPublicKycDocument,
} = require("../utils/clientMapper");

async function getClientRow(id, { includeDeleted = false } = {}) {
  const result = await pool.query(
    `SELECT * FROM clients
     WHERE id = $1
       AND ($2::boolean = TRUE OR deleted_at IS NULL)
     LIMIT 1`,
    [id, includeDeleted]
  );
  return result.rows[0] || null;
}

function buildWritableColumns(input) {
  const columns = [];
  const values = [];
  for (const [apiKey, dbCol] of Object.entries(CLIENT_WRITABLE_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(input, apiKey)) {
      let value = input[apiKey];
      if (value === "") value = null;
      columns.push(dbCol);
      values.push(value);
    }
  }
  return { columns, values };
}

async function createClient(input) {
  const { columns, values } = buildWritableColumns(input);

  if (!columns.includes("client_name")) {
    columns.push("client_name");
    values.push(input.clientName);
  }
  if (!columns.includes("client_type")) {
    columns.push("client_type");
    values.push(input.clientType || "buyer");
  }

  const placeholders = columns.map((_, i) => `$${i + 1}`);
  try {
    const result = await pool.query(
      `INSERT INTO clients (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING *`,
      values
    );
    return toPublicClient(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      throw new ApiError(409, "A client with this CNIC already exists");
    }
    if (err.code === "23514") {
      throw new ApiError(400, err.message || "Client data failed database checks");
    }
    throw err;
  }
}

async function listClients(query = {}) {
  const {
    search,
    clientType,
    preferredLocation,
    investmentPreference,
    preferredPropertyType,
    leadSource,
    budgetMin,
    budgetMax,
    followUpBefore,
    followUpAfter,
    page = 1,
    limit = 20,
  } = query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const where = ["c.deleted_at IS NULL"];
  const params = [];

  function add(sql, value) {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  }

  if (clientType) add("c.client_type = ?", String(clientType).toLowerCase());
  if (preferredLocation) {
    add("LOWER(c.preferred_location) LIKE LOWER(?)", `%${preferredLocation}%`);
  }
  if (investmentPreference) {
    add("LOWER(c.investment_preference) LIKE LOWER(?)", `%${investmentPreference}%`);
  }
  if (preferredPropertyType) {
    add("LOWER(c.preferred_property_type) = LOWER(?)", preferredPropertyType);
  }
  if (leadSource) add("LOWER(c.lead_source) = LOWER(?)", leadSource);

  // Budget overlap: client range intersects requested range
  if (budgetMin !== undefined && budgetMin !== null && budgetMin !== "") {
    add("(c.budget_max IS NULL OR c.budget_max >= ?)", Number(budgetMin));
  }
  if (budgetMax !== undefined && budgetMax !== null && budgetMax !== "") {
    add("(c.budget_min IS NULL OR c.budget_min <= ?)", Number(budgetMax));
  }

  if (followUpBefore) add("c.next_follow_up_date <= ?", followUpBefore);
  if (followUpAfter) add("c.next_follow_up_date >= ?", followUpAfter);

  if (search && String(search).trim()) {
    const term = `%${String(search).trim()}%`;
    params.push(term, term, term, term);
    const i = params.length;
    where.push(
      `(c.client_name ILIKE $${i - 3}
        OR COALESCE(c.cnic, '') ILIKE $${i - 2}
        OR COALESCE(c.phone, '') ILIKE $${i - 1}
        OR COALESCE(c.email, '') ILIKE $${i})`
    );
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total FROM clients c ${whereSql}`,
    params
  );

  const listParams = [...params, limitNum, offset];
  const listResult = await pool.query(
    `SELECT c.* FROM clients c
     ${whereSql}
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  return {
    items: listResult.rows.map((row) => toPublicClient(row)),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limitNum) || 0,
    },
  };
}

async function getClientById(id) {
  const row = await getClientRow(id);
  if (!row) throw new ApiError(404, "Client not found");

  const [comms, kyc] = await Promise.all([
    pool.query(
      `SELECT * FROM client_communications
       WHERE client_id = $1
       ORDER BY communicated_at DESC, id DESC
       LIMIT 50`,
      [id]
    ),
    pool.query(
      `SELECT * FROM client_kyc_documents
       WHERE client_id = $1 AND deleted_at IS NULL
       ORDER BY uploaded_at DESC, id DESC`,
      [id]
    ),
  ]);

  return toPublicClient(row, {
    communications: comms.rows.map(toPublicCommunication),
    kycDocuments: kyc.rows.map(toPublicKycDocument),
  });
}

async function updateClient(id, input) {
  const existing = await getClientRow(id);
  if (!existing) throw new ApiError(404, "Client not found");

  const { columns, values } = buildWritableColumns(input);
  if (!columns.length) throw new ApiError(400, "No updatable fields provided");

  // Validate budget against existing values when only one side is updated
  const nextMin =
    input.budgetMin !== undefined
      ? input.budgetMin === "" || input.budgetMin === null
        ? null
        : Number(input.budgetMin)
      : existing.budget_min !== null
        ? Number(existing.budget_min)
        : null;
  const nextMax =
    input.budgetMax !== undefined
      ? input.budgetMax === "" || input.budgetMax === null
        ? null
        : Number(input.budgetMax)
      : existing.budget_max !== null
        ? Number(existing.budget_max)
        : null;
  if (nextMin !== null && nextMax !== null && nextMin > nextMax) {
    throw new ApiError(400, "Budget max must be greater than or equal to budget min");
  }

  const sets = columns.map((col, i) => `${col} = $${i + 1}`);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE clients
       SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    if (!result.rows[0]) throw new ApiError(404, "Client not found");
    return toPublicClient(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      throw new ApiError(409, "A client with this CNIC already exists");
    }
    if (err.code === "23514") {
      throw new ApiError(400, err.message || "Client update failed database checks");
    }
    throw err;
  }
}

async function updateCrmNotes(id, crmNotes) {
  return updateClient(id, { crmNotes: crmNotes === undefined ? null : crmNotes });
}

async function updateFollowUpDate(id, nextFollowUpDate) {
  return updateClient(id, { nextFollowUpDate });
}

async function softDeleteClient(id, adminId) {
  const existing = await getClientRow(id);
  if (!existing) throw new ApiError(404, "Client not found");

  // Preserve history: block soft-delete if active bookings reference this client
  const bookings = await pool.query(
    `SELECT COUNT(*)::INT AS count
     FROM bookings
     WHERE client_id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (bookings.rows[0].count > 0) {
    throw new ApiError(
      400,
      "Cannot archive client while active bookings exist for this client"
    );
  }

  const result = await pool.query(
    `UPDATE clients
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [adminId, id]
  );
  if (!result.rows[0]) throw new ApiError(404, "Client not found");

  return {
    id: Number(result.rows[0].id),
    clientName: result.rows[0].client_name,
    deletedAt: result.rows[0].deleted_at,
  };
}

/* --------------------------- Communications --------------------------- */

async function listCommunications(clientId) {
  const client = await getClientRow(clientId);
  if (!client) throw new ApiError(404, "Client not found");

  const result = await pool.query(
    `SELECT * FROM client_communications
     WHERE client_id = $1
     ORDER BY communicated_at DESC, id DESC`,
    [clientId]
  );

  return {
    clientId,
    items: result.rows.map(toPublicCommunication),
  };
}

async function addCommunication(clientId, input, adminId) {
  const client = await getClientRow(clientId);
  if (!client) throw new ApiError(404, "Client not found");

  const result = await pool.query(
    `INSERT INTO client_communications
       (client_id, communication_type, subject, notes, communicated_at, created_by)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, CURRENT_TIMESTAMP), $6)
     RETURNING *`,
    [
      clientId,
      input.communicationType || "note",
      input.subject || null,
      input.notes || null,
      input.communicatedAt || null,
      adminId,
    ]
  );

  return toPublicCommunication(result.rows[0]);
}

/* ------------------------------ KYC docs ------------------------------ */

async function listKycDocuments(clientId) {
  const client = await getClientRow(clientId);
  if (!client) throw new ApiError(404, "Client not found");

  const result = await pool.query(
    `SELECT * FROM client_kyc_documents
     WHERE client_id = $1 AND deleted_at IS NULL
     ORDER BY uploaded_at DESC, id DESC`,
    [clientId]
  );

  return {
    clientId,
    items: result.rows.map(toPublicKycDocument),
  };
}

async function addKycDocument(clientId, input, adminId) {
  const client = await getClientRow(clientId);
  if (!client) throw new ApiError(404, "Client not found");

  const result = await pool.query(
    `INSERT INTO client_kyc_documents
       (client_id, document_type, file_path, file_name, mime_type, expiry_date, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      clientId,
      input.documentType,
      input.filePath,
      input.fileName || null,
      input.mimeType || null,
      input.expiryDate || null,
      adminId,
    ]
  );

  return toPublicKycDocument(result.rows[0]);
}

async function softDeleteKycDocument(clientId, documentId, adminId) {
  const client = await getClientRow(clientId);
  if (!client) throw new ApiError(404, "Client not found");

  const result = await pool.query(
    `UPDATE client_kyc_documents
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1
     WHERE id = $2 AND client_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [adminId, documentId, clientId]
  );
  if (!result.rows[0]) throw new ApiError(404, "KYC document not found");

  return {
    id: Number(result.rows[0].id),
    clientId,
    deletedAt: result.rows[0].deleted_at,
  };
}

module.exports = {
  createClient,
  listClients,
  getClientById,
  updateClient,
  updateCrmNotes,
  updateFollowUpDate,
  softDeleteClient,
  listCommunications,
  addCommunication,
  listKycDocuments,
  addKycDocument,
  softDeleteKycDocument,
};
