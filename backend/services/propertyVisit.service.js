/**
 * Property visits — site viewings for Booking Calendar.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");

const VISIT_STATUSES = ["scheduled", "completed", "cancelled", "no_show"];

function toPublicVisit(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    propertyId: Number(row.property_id),
    propertyTitle: row.property_title || null,
    propertyCode: row.property_code || null,
    clientId: row.client_id != null ? Number(row.client_id) : null,
    clientName: row.client_name || null,
    visitDate: row.visit_date
      ? String(row.visit_date).slice(0, 10)
      : null,
    visitTime: row.visit_time != null ? String(row.visit_time).slice(0, 8) : null,
    status: row.status,
    notes: row.notes || null,
    createdBy: row.created_by != null ? Number(row.created_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertProperty(propertyId) {
  const result = await pool.query(
    `SELECT id FROM properties WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [propertyId]
  );
  if (!result.rows[0]) throw new ApiError(404, "Property not found");
}

async function listPropertyVisits(propertyId) {
  await assertProperty(propertyId);
  const result = await pool.query(
    `SELECT v.*, p.title AS property_title, p.property_code, c.client_name
     FROM property_visits v
     JOIN properties p ON p.id = v.property_id
     LEFT JOIN clients c ON c.id = v.client_id
     WHERE v.property_id = $1 AND v.deleted_at IS NULL
     ORDER BY v.visit_date DESC, v.id DESC`,
    [propertyId]
  );
  return result.rows.map(toPublicVisit);
}

async function createPropertyVisit(propertyId, input, adminId) {
  await assertProperty(propertyId);

  const visitDate = input.visitDate ? String(input.visitDate).slice(0, 10) : null;
  if (!visitDate || Number.isNaN(new Date(visitDate).getTime())) {
    throw new ApiError(400, "Visit date is required");
  }

  let clientId = null;
  if (input.clientId !== undefined && input.clientId !== null && input.clientId !== "") {
    clientId = Number(input.clientId);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      throw new ApiError(400, "Invalid client id");
    }
    const client = await pool.query(
      `SELECT id FROM clients WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [clientId]
    );
    if (!client.rows[0]) throw new ApiError(404, "Client not found");
  }

  const status = input.status
    ? String(input.status).toLowerCase()
    : "scheduled";
  if (!VISIT_STATUSES.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${VISIT_STATUSES.join(", ")}`);
  }

  let visitTime = null;
  if (input.visitTime !== undefined && input.visitTime !== null && String(input.visitTime).trim() !== "") {
    visitTime = String(input.visitTime).trim();
  }

  try {
    const result = await pool.query(
      `INSERT INTO property_visits
         (property_id, client_id, visit_date, visit_time, status, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        propertyId,
        clientId,
        visitDate,
        visitTime,
        status,
        input.notes ? String(input.notes).trim() : null,
        adminId,
      ]
    );
    const full = await pool.query(
      `SELECT v.*, p.title AS property_title, p.property_code, c.client_name
       FROM property_visits v
       JOIN properties p ON p.id = v.property_id
       LEFT JOIN clients c ON c.id = v.client_id
       WHERE v.id = $1`,
      [result.rows[0].id]
    );
    return toPublicVisit(full.rows[0]);
  } catch (err) {
    if (err.code === "42P01") {
      throw new ApiError(
        500,
        "Property visits table is missing. Run database/migrations/add_property_visits.sql"
      );
    }
    throw err;
  }
}

async function updatePropertyVisit(propertyId, visitId, input) {
  await assertProperty(propertyId);
  const existing = await pool.query(
    `SELECT * FROM property_visits
     WHERE id = $1 AND property_id = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [visitId, propertyId]
  );
  if (!existing.rows[0]) throw new ApiError(404, "Visit not found");

  const sets = [];
  const values = [];

  if (input.visitDate !== undefined) {
    const d = String(input.visitDate).slice(0, 10);
    if (Number.isNaN(new Date(d).getTime())) {
      throw new ApiError(400, "Invalid visit date");
    }
    values.push(d);
    sets.push(`visit_date = $${values.length}`);
  }
  if (input.visitTime !== undefined) {
    values.push(
      input.visitTime === null || String(input.visitTime).trim() === ""
        ? null
        : String(input.visitTime).trim()
    );
    sets.push(`visit_time = $${values.length}`);
  }
  if (input.status !== undefined) {
    const status = String(input.status).toLowerCase();
    if (!VISIT_STATUSES.includes(status)) {
      throw new ApiError(400, `Status must be one of: ${VISIT_STATUSES.join(", ")}`);
    }
    values.push(status);
    sets.push(`status = $${values.length}`);
  }
  if (input.notes !== undefined) {
    values.push(input.notes ? String(input.notes).trim() : null);
    sets.push(`notes = $${values.length}`);
  }
  if (input.clientId !== undefined) {
    if (input.clientId === null || input.clientId === "") {
      values.push(null);
    } else {
      const clientId = Number(input.clientId);
      if (!Number.isInteger(clientId) || clientId <= 0) {
        throw new ApiError(400, "Invalid client id");
      }
      values.push(clientId);
    }
    sets.push(`client_id = $${values.length}`);
  }

  if (!sets.length) throw new ApiError(400, "No updatable fields provided");

  values.push(visitId, propertyId);
  const result = await pool.query(
    `UPDATE property_visits
     SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${values.length - 1} AND property_id = $${values.length}
       AND deleted_at IS NULL
     RETURNING id`,
    values
  );
  if (!result.rows[0]) throw new ApiError(404, "Visit not found");

  const full = await pool.query(
    `SELECT v.*, p.title AS property_title, p.property_code, c.client_name
     FROM property_visits v
     JOIN properties p ON p.id = v.property_id
     LEFT JOIN clients c ON c.id = v.client_id
     WHERE v.id = $1`,
    [visitId]
  );
  return toPublicVisit(full.rows[0]);
}

async function deletePropertyVisit(propertyId, visitId, adminId) {
  await assertProperty(propertyId);
  const result = await pool.query(
    `UPDATE property_visits
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND property_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [visitId, propertyId, adminId]
  );
  if (!result.rows[0]) throw new ApiError(404, "Visit not found");
  return { id: Number(result.rows[0].id) };
}

module.exports = {
  VISIT_STATUSES,
  listPropertyVisits,
  createPropertyVisit,
  updatePropertyVisit,
  deletePropertyVisit,
};
