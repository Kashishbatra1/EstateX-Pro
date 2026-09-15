/**
 * Property History — read API over existing property_history writes.
 * Does not invent new event types; filters use approved enum values.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const { toPublicHistoryEvent } = require("../utils/propertyHistoryMapper");

async function assertPropertyExists(propertyId) {
  const result = await pool.query(
    `SELECT id FROM properties WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [propertyId]
  );
  if (!result.rows[0]) {
    throw new ApiError(404, "Property not found");
  }
}

async function listHistoryForProperty(propertyId, query = {}) {
  await assertPropertyExists(propertyId);

  const { eventType, page = 1, limit = 50 } = query;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  const where = ["ph.property_id = $1"];
  const params = [propertyId];

  if (eventType) {
    params.push(eventType);
    where.push(`ph.event_type = $${params.length}`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM property_history ph
     ${whereSql}`,
    params
  );

  const listParams = [...params, limitNum, offset];
  const listResult = await pool.query(
    `SELECT ph.*, a.full_name AS performed_by_name
     FROM property_history ph
     LEFT JOIN admins a ON a.id = ph.performed_by
     ${whereSql}
     ORDER BY ph.created_at DESC, ph.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  const total = countResult.rows[0].total;
  return {
    items: listResult.rows.map(toPublicHistoryEvent),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    },
  };
}

module.exports = {
  listHistoryForProperty,
};
