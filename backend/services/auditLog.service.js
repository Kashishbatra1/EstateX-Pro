/**
 * Audit log viewer — read-only over existing audit_logs table.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");

function toPublicAuditLog(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    adminId: row.admin_id != null ? Number(row.admin_id) : null,
    adminName: row.admin_name || null,
    adminEmail: row.admin_email || null,
    action: row.action,
    entityType: row.entity_type || null,
    entityId: row.entity_id != null ? Number(row.entity_id) : null,
    oldData: row.old_data ?? null,
    newData: row.new_data ?? null,
    ipAddress: row.ip_address || null,
    userAgent: row.user_agent || null,
    createdAt: row.created_at,
  };
}

function isValidDateOnly(value) {
  if (value === undefined || value === null || String(value).trim() === "") return false;
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

async function listAuditLogs(query = {}) {
  const {
    action,
    entityType,
    entityId,
    adminId,
    search,
    dateFrom,
    dateTo,
    page = 1,
    limit = 30,
  } = query;

  if (dateFrom && !isValidDateOnly(dateFrom)) {
    throw new ApiError(400, "Validation failed", [
      { field: "dateFrom", message: "dateFrom must be YYYY-MM-DD" },
    ]);
  }
  if (dateTo && !isValidDateOnly(dateTo)) {
    throw new ApiError(400, "Validation failed", [
      { field: "dateTo", message: "dateTo must be YYYY-MM-DD" },
    ]);
  }
  if (dateFrom && dateTo && String(dateFrom).slice(0, 10) > String(dateTo).slice(0, 10)) {
    throw new ApiError(400, "Validation failed", [
      { field: "dateFrom", message: "dateFrom must be on or before dateTo" },
    ]);
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 30));
  const offset = (pageNum - 1) * limitNum;
  const where = ["1=1"];
  const params = [];

  if (action && String(action).trim()) {
    params.push(`%${String(action).trim()}%`);
    where.push(`a.action ILIKE $${params.length}`);
  }
  if (entityType && String(entityType).trim()) {
    params.push(String(entityType).trim());
    where.push(`a.entity_type = $${params.length}`);
  }
  if (entityId !== undefined && entityId !== null && entityId !== "") {
    const eid = Number(entityId);
    if (!Number.isInteger(eid) || eid <= 0) {
      throw new ApiError(400, "Validation failed", [
        { field: "entityId", message: "entityId must be a positive integer" },
      ]);
    }
    params.push(eid);
    where.push(`a.entity_id = $${params.length}`);
  }
  if (adminId !== undefined && adminId !== null && adminId !== "") {
    const aid = Number(adminId);
    if (!Number.isInteger(aid) || aid <= 0) {
      throw new ApiError(400, "Validation failed", [
        { field: "adminId", message: "adminId must be a positive integer" },
      ]);
    }
    params.push(aid);
    where.push(`a.admin_id = $${params.length}`);
  }
  if (search && String(search).trim()) {
    params.push(`%${String(search).trim()}%`);
    where.push(
      `(a.action ILIKE $${params.length}
        OR COALESCE(a.entity_type, '') ILIKE $${params.length}
        OR COALESCE(adm.full_name, '') ILIKE $${params.length}
        OR COALESCE(adm.email, '') ILIKE $${params.length}
        OR CAST(a.entity_id AS TEXT) ILIKE $${params.length})`
    );
  }
  if (dateFrom) {
    params.push(String(dateFrom).slice(0, 10));
    where.push(`a.created_at >= $${params.length}::date`);
  }
  if (dateTo) {
    params.push(String(dateTo).slice(0, 10));
    where.push(`a.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  const whereSql = where.join(" AND ");
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM audit_logs a
     LEFT JOIN admins adm ON adm.id = a.admin_id
     WHERE ${whereSql}`,
    params
  );
  const total = countResult.rows[0].total;

  params.push(limitNum, offset);
  const result = await pool.query(
    `SELECT a.*,
            adm.full_name AS admin_name,
            adm.email AS admin_email
     FROM audit_logs a
     LEFT JOIN admins adm ON adm.id = a.admin_id
     WHERE ${whereSql}
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    items: result.rows.map(toPublicAuditLog),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    },
  };
}

async function getAuditLogById(id) {
  const result = await pool.query(
    `SELECT a.*,
            adm.full_name AS admin_name,
            adm.email AS admin_email
     FROM audit_logs a
     LEFT JOIN admins adm ON adm.id = a.admin_id
     WHERE a.id = $1
     LIMIT 1`,
    [id]
  );
  if (!result.rows[0]) throw new ApiError(404, "Audit log not found");
  return toPublicAuditLog(result.rows[0]);
}

module.exports = {
  listAuditLogs,
  getAuditLogById,
  toPublicAuditLog,
};
