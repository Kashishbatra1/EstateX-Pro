/**
 * Property Maintenance service — CRUD + deadline reminders.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  WRITABLE_FIELDS,
  toPublicMaintenance,
} = require("../utils/maintenanceMapper");
const {
  createNotificationRecord,
  notificationExists,
} = require("./notification.service");

const DETAIL_SELECT = `
  SELECT m.*,
         p.title AS property_title,
         p.property_code,
         e.full_name AS assigned_to_name,
         v.vendor_name
  FROM maintenance_tasks m
  JOIN properties p ON p.id = m.property_id
  LEFT JOIN employees e ON e.id = m.assigned_to
  LEFT JOIN vendors v ON v.id = m.vendor_id
`;

async function writeAudit(clientOrPool, adminId, action, entityId, oldData, newData) {
  await clientOrPool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, 'maintenance_tasks', $3, $4::jsonb, $5::jsonb)`,
    [
      adminId,
      action,
      entityId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
    ]
  );
}

async function assertProperty(propertyId) {
  const result = await pool.query(
    `SELECT id FROM properties WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [propertyId]
  );
  if (!result.rows[0]) {
    throw new ApiError(400, "Property not found", [
      { field: "propertyId", message: "Valid property is required" },
    ]);
  }
}

async function assertEmployee(employeeId) {
  if (employeeId == null) return;
  const result = await pool.query(
    `SELECT id FROM employees WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE LIMIT 1`,
    [employeeId]
  );
  if (!result.rows[0]) {
    throw new ApiError(400, "Employee not found", [
      { field: "assignedTo", message: "Valid active employee is required" },
    ]);
  }
}

async function assertVendor(vendorId) {
  if (vendorId == null) return;
  const result = await pool.query(
    `SELECT id FROM vendors WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [vendorId]
  );
  if (!result.rows[0]) {
    throw new ApiError(400, "Vendor not found", [
      { field: "vendorId", message: "Valid vendor is required" },
    ]);
  }
}

async function getTaskRow(id, { includeDeleted = false } = {}) {
  const result = await pool.query(
    `${DETAIL_SELECT}
     WHERE m.id = $1 AND ($2::boolean = TRUE OR m.deleted_at IS NULL)
     LIMIT 1`,
    [id, includeDeleted]
  );
  return result.rows[0] || null;
}

/** Mark past-due open tasks as overdue (best-effort, no schema change). */
async function syncOverdueStatuses() {
  await pool.query(
    `UPDATE maintenance_tasks
     SET status = 'overdue',
         updated_at = CURRENT_TIMESTAMP
     WHERE deleted_at IS NULL
       AND status IN ('scheduled', 'in_progress')
       AND due_date < CURRENT_DATE`
  );
}

async function listTasks(query = {}) {
  await syncOverdueStatuses();

  const {
    search,
    status,
    priority,
    propertyId,
    vendorId,
    assignedTo,
    dueSoon,
    page = 1,
    limit = 20,
  } = query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;
  const where = ["m.deleted_at IS NULL"];
  const params = [];

  if (status && String(status).trim()) {
    params.push(String(status).trim());
    where.push(`m.status = $${params.length}`);
  }
  if (priority && String(priority).trim()) {
    params.push(String(priority).trim());
    where.push(`m.priority = $${params.length}`);
  }
  if (propertyId) {
    params.push(Number(propertyId));
    where.push(`m.property_id = $${params.length}`);
  }
  if (vendorId) {
    params.push(Number(vendorId));
    where.push(`m.vendor_id = $${params.length}`);
  }
  if (assignedTo) {
    params.push(Number(assignedTo));
    where.push(`m.assigned_to = $${params.length}`);
  }
  if (dueSoon === "true" || dueSoon === true) {
    where.push(
      `m.due_date <= CURRENT_DATE + m.reminder_days_before
       AND m.status NOT IN ('completed', 'cancelled')`
    );
  }
  if (search && String(search).trim()) {
    params.push(`%${String(search).trim()}%`);
    where.push(
      `(m.title ILIKE $${params.length}
        OR COALESCE(m.category, '') ILIKE $${params.length}
        OR COALESCE(p.title, '') ILIKE $${params.length}
        OR COALESCE(p.property_code, '') ILIKE $${params.length})`
    );
  }

  const whereSql = where.join(" AND ");
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM maintenance_tasks m
     JOIN properties p ON p.id = m.property_id
     WHERE ${whereSql}`,
    params
  );
  const total = countResult.rows[0].total;

  params.push(limitNum, offset);
  const result = await pool.query(
    `${DETAIL_SELECT}
     WHERE ${whereSql}
     ORDER BY
       CASE m.priority
         WHEN 'urgent' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         ELSE 4
       END,
       m.due_date ASC,
       m.id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    items: result.rows.map(toPublicMaintenance),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    },
  };
}

async function getTaskById(id) {
  await syncOverdueStatuses();
  const row = await getTaskRow(id);
  if (!row) throw new ApiError(404, "Maintenance task not found");
  return toPublicMaintenance(row);
}

async function createTask(input, adminId) {
  await assertProperty(input.propertyId);
  await assertEmployee(input.assignedTo);
  await assertVendor(input.vendorId);

  const status = input.status || "scheduled";
  const completedAt = status === "completed" ? new Date() : null;

  const result = await pool.query(
    `INSERT INTO maintenance_tasks (
       property_id, title, description, category, status, priority,
       due_date, completed_at, assigned_to, vendor_id,
       estimated_cost, actual_cost, reminder_days_before, notes, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [
      input.propertyId,
      input.title,
      input.description || null,
      input.category || null,
      status,
      input.priority || "medium",
      input.dueDate,
      completedAt,
      input.assignedTo || null,
      input.vendorId || null,
      input.estimatedCost != null ? input.estimatedCost : null,
      input.actualCost != null ? input.actualCost : null,
      input.reminderDaysBefore != null ? input.reminderDaysBefore : 3,
      input.notes || null,
      adminId,
    ]
  );

  const id = result.rows[0].id;
  await writeAudit(pool, adminId, "MAINTENANCE_CREATE", id, null, {
    title: input.title,
    propertyId: input.propertyId,
    dueDate: input.dueDate,
    status,
  });
  return getTaskById(id);
}

async function updateTask(id, input, adminId) {
  const existing = await getTaskRow(id);
  if (!existing) throw new ApiError(404, "Maintenance task not found");

  if (input.propertyId !== undefined) await assertProperty(input.propertyId);
  if (input.assignedTo !== undefined) await assertEmployee(input.assignedTo);
  if (input.vendorId !== undefined) await assertVendor(input.vendorId);

  const columns = [];
  const values = [];
  for (const [apiKey, dbCol] of Object.entries(WRITABLE_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(input, apiKey)) continue;
    let value = input[apiKey];
    if (value === "") value = null;
    columns.push(dbCol);
    values.push(value);
  }

  const nextStatus =
    input.status !== undefined ? input.status : existing.status;
  if (input.status !== undefined) {
    if (nextStatus === "completed" && !existing.completed_at) {
      columns.push("completed_at");
      values.push(new Date());
    } else if (nextStatus !== "completed" && existing.completed_at) {
      columns.push("completed_at");
      values.push(null);
    }
  }

  if (!columns.length) {
    throw new ApiError(400, "Validation failed", [
      { field: "body", message: "No updatable fields provided" },
    ]);
  }

  values.push(id);
  const result = await pool.query(
    `UPDATE maintenance_tasks
     SET ${columns.map((c, i) => `${c} = $${i + 1}`).join(", ")},
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $${values.length} AND deleted_at IS NULL
     RETURNING id`,
    values
  );
  if (!result.rows[0]) throw new ApiError(404, "Maintenance task not found");

  await writeAudit(
    pool,
    adminId,
    "MAINTENANCE_UPDATE",
    id,
    { title: existing.title, status: existing.status },
    { title: input.title || existing.title, status: nextStatus }
  );
  return getTaskById(id);
}

async function softDeleteTask(id, adminId) {
  const existing = await getTaskRow(id);
  if (!existing) throw new ApiError(404, "Maintenance task not found");

  await pool.query(
    `UPDATE maintenance_tasks
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND deleted_at IS NULL`,
    [adminId, id]
  );
  await writeAudit(
    pool,
    adminId,
    "MAINTENANCE_SOFT_DELETE",
    id,
    { title: existing.title },
    null
  );
  return { id: Number(existing.id), title: existing.title, deleted: true };
}

async function processDeadlineReminders(adminId = null) {
  await syncOverdueStatuses();

  const due = await pool.query(
    `SELECT m.*, p.title AS property_title
     FROM maintenance_tasks m
     JOIN properties p ON p.id = m.property_id
     WHERE m.deleted_at IS NULL
       AND m.status NOT IN ('completed', 'cancelled')
       AND m.due_date >= CURRENT_DATE
       AND m.due_date <= CURRENT_DATE + m.reminder_days_before
     ORDER BY m.due_date ASC, m.id ASC`
  );

  let created = 0;
  let skipped = 0;

  for (const row of due.rows) {
    const title = `Maintenance deadline: ${row.title}`;
    const exists = await notificationExists({
      notificationType: "maintenance_deadline",
      entityType: "maintenance_tasks",
      entityId: row.id,
      title,
      withinDays: Math.max(1, Number(row.reminder_days_before) || 3),
    });
    if (exists) {
      skipped += 1;
      continue;
    }

    await createNotificationRecord(
      {
        adminId: adminId || null,
        notificationType: "maintenance_deadline",
        title,
        message: `"${row.title}" on ${row.property_title} is due ${String(row.due_date).slice(0, 10)} (${row.priority}).`,
        entityType: "maintenance_tasks",
        entityId: Number(row.id),
      },
      { adminId }
    );
    created += 1;
  }

  return { scanned: due.rows.length, created, skipped };
}

module.exports = {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  softDeleteTask,
  processDeadlineReminders,
  syncOverdueStatuses,
};
