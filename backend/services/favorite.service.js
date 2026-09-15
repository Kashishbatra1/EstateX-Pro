/**
 * Favorites — pin properties/clients/owners/vendors/bookings/expenses per admin.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");

const ENTITY_TYPES = [
  "property",
  "client",
  "owner",
  "vendor",
  "booking",
  "expense",
];

const ENTITY_TABLE = {
  property: { table: "properties", label: "title", path: "/properties" },
  client: { table: "clients", label: "client_name", path: "/clients" },
  owner: { table: "owners", label: "owner_name", path: "/owners" },
  vendor: { table: "vendors", label: "vendor_name", path: "/vendors" },
  booking: { table: "bookings", label: "booking_code", path: "/bookings" },
  expense: { table: "expenses", label: "expense_code", path: "/expenses" },
};

function toPublicFavorite(row) {
  return {
    id: Number(row.id),
    adminId: Number(row.admin_id),
    entityType: row.entity_type,
    entityId: Number(row.entity_id),
    label: row.label || null,
    path: row.path || null,
    createdAt: row.created_at,
  };
}

async function assertEntityExists(entityType, entityId) {
  const meta = ENTITY_TABLE[entityType];
  if (!meta) {
    throw new ApiError(400, "Invalid entity type", [
      { field: "entityType", message: `Must be one of: ${ENTITY_TYPES.join(", ")}` },
    ]);
  }
  const result = await pool.query(
    `SELECT id, ${meta.label} AS label FROM ${meta.table}
     WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [entityId]
  );
  if (!result.rows[0]) {
    throw new ApiError(404, `${entityType} not found`);
  }
  return {
    label: result.rows[0].label,
    path: `${meta.path}/${entityId}`,
  };
}

async function listFavorites(adminId, query = {}) {
  const { entityType, entityId } = query;
  const where = ["f.admin_id = $1"];
  const params = [adminId];
  if (entityType) {
    if (!ENTITY_TYPES.includes(String(entityType))) {
      throw new ApiError(400, "Invalid entityType");
    }
    params.push(entityType);
    where.push(`f.entity_type = $${params.length}`);
  }
  if (entityId !== undefined && entityId !== null && entityId !== "") {
    const eid = Number(entityId);
    if (!Number.isInteger(eid) || eid <= 0) {
      throw new ApiError(400, "Invalid entityId");
    }
    params.push(eid);
    where.push(`f.entity_id = $${params.length}`);
  }

  const result = await pool.query(
    `SELECT f.* FROM favorites f
     WHERE ${where.join(" AND ")}
     ORDER BY f.created_at DESC, f.id DESC`,
    params
  );

  const items = [];
  for (const row of result.rows) {
    const meta = ENTITY_TABLE[row.entity_type];
    let label = null;
    let path = meta ? `${meta.path}/${row.entity_id}` : null;
    if (meta) {
      const ent = await pool.query(
        `SELECT ${meta.label} AS label FROM ${meta.table}
         WHERE id = $1 LIMIT 1`,
        [row.entity_id]
      );
      label = ent.rows[0]?.label || `#${row.entity_id}`;
    }
    items.push(
      toPublicFavorite({ ...row, label, path })
    );
  }
  return { items };
}

async function addFavorite(adminId, input) {
  const entityType = String(input.entityType || "").toLowerCase();
  const entityId = Number(input.entityId);
  if (!ENTITY_TYPES.includes(entityType)) {
    throw new ApiError(400, "Validation failed", [
      {
        field: "entityType",
        message: `Must be one of: ${ENTITY_TYPES.join(", ")}`,
      },
    ]);
  }
  if (!Number.isInteger(entityId) || entityId <= 0) {
    throw new ApiError(400, "Validation failed", [
      { field: "entityId", message: "Valid entity id is required" },
    ]);
  }

  const info = await assertEntityExists(entityType, entityId);

  try {
    const result = await pool.query(
      `INSERT INTO favorites (admin_id, entity_type, entity_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [adminId, entityType, entityId]
    );
    return toPublicFavorite({
      ...result.rows[0],
      label: info.label,
      path: info.path,
    });
  } catch (err) {
    if (err.code === "23505") {
      throw new ApiError(409, "Already in favorites");
    }
    throw err;
  }
}

async function removeFavorite(adminId, id) {
  const result = await pool.query(
    `DELETE FROM favorites
     WHERE id = $1 AND admin_id = $2
     RETURNING *`,
    [id, adminId]
  );
  if (!result.rows[0]) throw new ApiError(404, "Favorite not found");
  return { id: Number(result.rows[0].id), deleted: true };
}

async function removeFavoriteByEntity(adminId, entityType, entityId) {
  const result = await pool.query(
    `DELETE FROM favorites
     WHERE admin_id = $1 AND entity_type = $2 AND entity_id = $3
     RETURNING *`,
    [adminId, entityType, entityId]
  );
  if (!result.rows[0]) throw new ApiError(404, "Favorite not found");
  return { id: Number(result.rows[0].id), deleted: true };
}

module.exports = {
  ENTITY_TYPES,
  listFavorites,
  addFavorite,
  removeFavorite,
  removeFavoriteByEntity,
};
