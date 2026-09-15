/**
 * Notifications & Reminders service — uses existing notifications table only.
 * Reminder types map to schema enums:
 *   booking_expiry → booking expiry approaching
 *   rent_due → installment due / overdue (closest schema-supported type)
 *   general → booking lifecycle events
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  NOTIFICATION_TYPES,
  toPublicNotification,
} = require("../utils/notificationMapper");

const DEFAULT_REMINDER_DAYS = 7;

async function writeAudit(adminId, action, entityId, oldData, newData) {
  await pool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, 'notification', $3, $4::jsonb, $5::jsonb)`,
    [
      adminId || null,
      action,
      entityId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
    ]
  );
}

/**
 * Visible to admin if targeted to them or broadcast (admin_id IS NULL).
 */
function visibilityClause(adminId, params) {
  params.push(adminId);
  return `(n.admin_id IS NULL OR n.admin_id = $${params.length})`;
}

async function notificationExists({
  notificationType,
  entityType,
  entityId,
  title,
  withinDays = 7,
  client = pool,
}) {
  const result = await client.query(
    `SELECT 1
     FROM notifications
     WHERE notification_type = $1
       AND entity_type = $2
       AND entity_id = $3
       AND ($4::text IS NULL OR title = $4)
       AND created_at >= CURRENT_TIMESTAMP - ($5::int || ' days')::interval
     LIMIT 1`,
    [notificationType, entityType, entityId, title || null, withinDays]
  );
  return Boolean(result.rows[0]);
}

async function createNotificationRecord(input, { client = pool, skipAudit = false, adminId = null } = {}) {
  const type = input.notificationType || "general";
  if (!NOTIFICATION_TYPES.includes(type)) {
    throw new ApiError(400, `Invalid notification type: ${type}`);
  }

  const result = await client.query(
    `INSERT INTO notifications (
       admin_id, notification_type, title, message, entity_type, entity_id
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.adminId !== undefined ? input.adminId : null,
      type,
      input.title,
      input.message,
      input.entityType || null,
      input.entityId || null,
    ]
  );

  const row = result.rows[0];
  if (!skipAudit) {
    await writeAudit(adminId, "NOTIFICATION_CREATE", row.id, null, {
      notificationType: type,
      title: input.title,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
    });
  }
  return toPublicNotification(row);
}

async function createNotification(input, actingAdminId) {
  if (input.adminId) {
    const admin = await pool.query(
      `SELECT id FROM admins WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [input.adminId]
    );
    if (!admin.rows[0]) {
      throw new ApiError(400, "Target admin not found", [
        { field: "adminId", message: "Valid active admin is required" },
      ]);
    }
  }

  return createNotificationRecord(
    {
      adminId: input.adminId !== undefined ? input.adminId : actingAdminId,
      notificationType: input.notificationType || "general",
      title: input.title,
      message: input.message,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
    },
    { adminId: actingAdminId, skipAudit: false }
  );
}

/**
 * Safe helper for other modules — never throws to callers (logs and returns null).
 */
async function notifyEvent(input) {
  try {
    const exists = await notificationExists({
      notificationType: input.notificationType || "general",
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      withinDays: input.dedupeDays !== undefined ? input.dedupeDays : 1,
    });
    if (exists) return null;

    return await createNotificationRecord(input, {
      skipAudit: true,
      client: pool,
    });
  } catch (err) {
    console.error("[notifications] notifyEvent failed:", err.message);
    return null;
  }
}

async function listNotifications(query = {}, adminId) {
  const {
    isRead,
    notificationType,
    entityType,
    page = 1,
    limit = 20,
  } = query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const params = [];
  const where = [visibilityClause(adminId, params)];

  if (isRead === "true" || isRead === true) {
    where.push("n.is_read = TRUE");
  } else if (isRead === "false" || isRead === false) {
    where.push("n.is_read = FALSE");
  }

  if (notificationType) {
    params.push(String(notificationType).toLowerCase());
    where.push(`n.notification_type = $${params.length}`);
  }
  if (entityType) {
    params.push(String(entityType));
    where.push(`n.entity_type = $${params.length}`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total FROM notifications n ${whereSql}`,
    params
  );

  const listParams = [...params, limitNum, offset];
  const listResult = await pool.query(
    `SELECT n.* FROM notifications n
     ${whereSql}
     ORDER BY n.is_read ASC, n.created_at DESC, n.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  const unreadParams = [adminId];
  const unreadResult = await pool.query(
    `SELECT COUNT(*)::INT AS unread
     FROM notifications n
     WHERE (n.admin_id IS NULL OR n.admin_id = $1)
       AND n.is_read = FALSE`,
    unreadParams
  );

  return {
    items: listResult.rows.map(toPublicNotification),
    unreadCount: unreadResult.rows[0].unread,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limitNum) || 0,
    },
  };
}

async function getNotificationById(id, adminId) {
  const result = await pool.query(
    `SELECT n.* FROM notifications n
     WHERE n.id = $1
       AND (n.admin_id IS NULL OR n.admin_id = $2)
     LIMIT 1`,
    [id, adminId]
  );
  if (!result.rows[0]) throw new ApiError(404, "Notification not found");
  return toPublicNotification(result.rows[0]);
}

async function markRead(id, adminId, isRead = true) {
  const existing = await getNotificationById(id, adminId);
  const result = await pool.query(
    `UPDATE notifications
     SET is_read = $1,
         read_at = CASE WHEN $1 = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END
     WHERE id = $2
       AND (admin_id IS NULL OR admin_id = $3)
     RETURNING *`,
    [isRead, id, adminId]
  );
  if (!result.rows[0]) throw new ApiError(404, "Notification not found");
  return toPublicNotification(result.rows[0]);
}

async function markAllRead(adminId) {
  const result = await pool.query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
     WHERE is_read = FALSE
       AND (admin_id IS NULL OR admin_id = $1)
     RETURNING id`,
    [adminId]
  );
  return { updatedCount: result.rowCount };
}

async function deleteNotification(id, adminId) {
  // Schema has no soft-delete; hard delete only for visible notifications
  const existing = await getNotificationById(id, adminId);
  await pool.query(
    `DELETE FROM notifications
     WHERE id = $1
       AND (admin_id IS NULL OR admin_id = $2)`,
    [id, adminId]
  );
  await writeAudit(adminId, "NOTIFICATION_DELETE", id, existing, { deleted: true });
  return { id, deleted: true };
}

/**
 * Process booking expiry + installment due/overdue reminders.
 * Idempotent via duplicate prevention window.
 */
async function processReminders({ daysAhead = DEFAULT_REMINDER_DAYS } = {}) {
  const days = Math.max(1, Math.min(90, Number(daysAhead) || DEFAULT_REMINDER_DAYS));
  const created = [];

  // 1) Booking expiry approaching
  const expiring = await pool.query(
    `SELECT b.id, b.booking_code, b.booking_expiry_date, b.created_by
     FROM bookings b
     WHERE b.deleted_at IS NULL
       AND b.status IN ('pending', 'confirmed')
       AND b.booking_expiry_date IS NOT NULL
       AND b.booking_expiry_date >= CURRENT_DATE
       AND b.booking_expiry_date <= CURRENT_DATE + $1::int`,
    [days]
  );

  for (const row of expiring.rows) {
    const title = `Booking expiry reminder`;
    const exists = await notificationExists({
      notificationType: "booking_expiry",
      entityType: "booking",
      entityId: row.id,
      title,
      withinDays: days,
    });
    if (exists) continue;

    const note = await createNotificationRecord(
      {
        adminId: row.created_by || null,
        notificationType: "booking_expiry",
        title,
        message: `Booking ${row.booking_code} expires on ${row.booking_expiry_date}`,
        entityType: "booking",
        entityId: Number(row.id),
      },
      { skipAudit: true }
    );
    created.push(note);
  }

  // 2) Upcoming installment due (use rent_due — schema-supported due-payment type)
  const dueSoon = await pool.query(
    `SELECT bi.id AS installment_id, bi.due_date, bi.amount_due, bi.amount_paid,
            bi.installment_number, b.id AS booking_id, b.booking_code, b.created_by
     FROM booking_installments bi
     JOIN bookings b ON b.id = bi.booking_id
     WHERE b.deleted_at IS NULL
       AND b.status IN ('pending', 'confirmed')
       AND bi.status IN ('pending', 'partial', 'overdue')
       AND bi.due_date >= CURRENT_DATE
       AND bi.due_date <= CURRENT_DATE + $1::int
       AND bi.amount_paid < bi.amount_due`,
    [days]
  );

  for (const row of dueSoon.rows) {
    const title = `Installment due reminder`;
    const exists = await notificationExists({
      notificationType: "rent_due",
      entityType: "booking_installment",
      entityId: row.installment_id,
      title,
      withinDays: days,
    });
    if (exists) continue;

    const note = await createNotificationRecord(
      {
        adminId: row.created_by || null,
        notificationType: "rent_due",
        title,
        message: `Installment #${row.installment_number} for booking ${row.booking_code} is due on ${row.due_date}`,
        entityType: "booking_installment",
        entityId: Number(row.installment_id),
      },
      { skipAudit: true }
    );
    created.push(note);
  }

  // 3) Overdue installments — mark overdue + notify
  const overdue = await pool.query(
    `SELECT bi.id AS installment_id, bi.due_date, bi.status, bi.installment_number,
            bi.amount_due, bi.amount_paid,
            b.id AS booking_id, b.booking_code, b.created_by
     FROM booking_installments bi
     JOIN bookings b ON b.id = bi.booking_id
     WHERE b.deleted_at IS NULL
       AND b.status IN ('pending', 'confirmed')
       AND bi.status IN ('pending', 'partial', 'overdue')
       AND bi.due_date < CURRENT_DATE
       AND bi.amount_paid < bi.amount_due`
  );

  for (const row of overdue.rows) {
    if (row.status !== "overdue") {
      await pool.query(
        `UPDATE booking_installments
         SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [row.installment_id]
      );
    }

    const title = `Installment overdue`;
    const exists = await notificationExists({
      notificationType: "rent_due",
      entityType: "booking_installment",
      entityId: row.installment_id,
      title,
      withinDays: days,
    });
    if (exists) continue;

    const note = await createNotificationRecord(
      {
        adminId: row.created_by || null,
        notificationType: "rent_due",
        title,
        message: `Installment #${row.installment_number} for booking ${row.booking_code} is overdue (due ${row.due_date})`,
        entityType: "booking_installment",
        entityId: Number(row.installment_id),
      },
      { skipAudit: true }
    );
    created.push(note);
  }

  // 4) Property / KYC / vendor documents approaching or past expiry
  const propertyDocs = await pool.query(
    `SELECT d.id, d.document_name, d.document_type, d.expiry_date, d.property_id,
            p.title AS property_title, d.uploaded_by
     FROM property_documents d
     JOIN properties p ON p.id = d.property_id AND p.deleted_at IS NULL
     WHERE d.deleted_at IS NULL
       AND d.expiry_date IS NOT NULL
       AND d.expiry_date <= CURRENT_DATE + $1::int`,
    [days]
  );

  for (const row of propertyDocs.rows) {
    const expired = String(row.expiry_date).slice(0, 10) < new Date().toISOString().slice(0, 10);
    const title = expired ? "Property document expired" : "Property document expiring";
    const exists = await notificationExists({
      notificationType: "document_expiry",
      entityType: "property_document",
      entityId: row.id,
      title,
      withinDays: days,
    });
    if (exists) continue;

    const label = row.document_name || row.document_type || `Document #${row.id}`;
    const note = await createNotificationRecord(
      {
        adminId: row.uploaded_by || null,
        notificationType: "document_expiry",
        title,
        message: `${label} for "${row.property_title}" ${expired ? "expired" : "expires"} on ${String(row.expiry_date).slice(0, 10)}`,
        entityType: "property_document",
        entityId: Number(row.id),
      },
      { skipAudit: true }
    );
    created.push(note);
  }

  const kycDocs = await pool.query(
    `SELECT d.id, d.document_type, d.file_name, d.expiry_date, d.client_id,
            c.client_name AS client_name, d.uploaded_by
     FROM client_kyc_documents d
     JOIN clients c ON c.id = d.client_id AND c.deleted_at IS NULL
     WHERE d.deleted_at IS NULL
       AND d.expiry_date IS NOT NULL
       AND d.expiry_date <= CURRENT_DATE + $1::int`,
    [days]
  );

  for (const row of kycDocs.rows) {
    const expired = String(row.expiry_date).slice(0, 10) < new Date().toISOString().slice(0, 10);
    const title = expired ? "KYC document expired" : "KYC document expiring";
    const exists = await notificationExists({
      notificationType: "document_expiry",
      entityType: "client_kyc_document",
      entityId: row.id,
      title,
      withinDays: days,
    });
    if (exists) continue;

    const label = row.file_name || row.document_type || `KYC #${row.id}`;
    const note = await createNotificationRecord(
      {
        adminId: row.uploaded_by || null,
        notificationType: "document_expiry",
        title,
        message: `${label} for client "${row.client_name}" ${expired ? "expired" : "expires"} on ${String(row.expiry_date).slice(0, 10)}`,
        entityType: "client_kyc_document",
        entityId: Number(row.id),
      },
      { skipAudit: true }
    );
    created.push(note);
  }

  const vendorDocs = await pool.query(
    `SELECT d.id, d.document_name, d.document_type, d.expiry_date, d.vendor_id,
            v.vendor_name, d.uploaded_by
     FROM vendor_documents d
     JOIN vendors v ON v.id = d.vendor_id AND v.deleted_at IS NULL
     WHERE d.deleted_at IS NULL
       AND d.expiry_date IS NOT NULL
       AND d.expiry_date <= CURRENT_DATE + $1::int`,
    [days]
  );

  for (const row of vendorDocs.rows) {
    const expired = String(row.expiry_date).slice(0, 10) < new Date().toISOString().slice(0, 10);
    const title = expired ? "Vendor document expired" : "Vendor document expiring";
    const exists = await notificationExists({
      notificationType: "document_expiry",
      entityType: "vendor_document",
      entityId: row.id,
      title,
      withinDays: days,
    });
    if (exists) continue;

    const label = row.document_name || row.document_type || `Document #${row.id}`;
    const note = await createNotificationRecord(
      {
        adminId: row.uploaded_by || null,
        notificationType: "document_expiry",
        title,
        message: `${label} for vendor "${row.vendor_name}" ${expired ? "expired" : "expires"} on ${String(row.expiry_date).slice(0, 10)}`,
        entityType: "vendor_document",
        entityId: Number(row.id),
      },
      { skipAudit: true }
    );
    created.push(note);
  }

  // 5) Vendor contract end / renewal window
  const contracts = await pool.query(
    `SELECT v.id, v.vendor_name, v.contract_end_date
     FROM vendors v
     WHERE v.deleted_at IS NULL
       AND v.contract_end_date IS NOT NULL
       AND v.contract_end_date <= CURRENT_DATE + $1::int`,
    [days]
  );

  for (const row of contracts.rows) {
    const expired = String(row.contract_end_date).slice(0, 10) < new Date().toISOString().slice(0, 10);
    const title = expired ? "Vendor contract ended" : "Vendor contract renewal";
    const exists = await notificationExists({
      notificationType: "vendor_contract_renewal",
      entityType: "vendor",
      entityId: row.id,
      title,
      withinDays: days,
    });
    if (exists) continue;

    const note = await createNotificationRecord(
      {
        adminId: null,
        notificationType: "vendor_contract_renewal",
        title,
        message: `Contract for "${row.vendor_name}" ${expired ? "ended" : "ends"} on ${String(row.contract_end_date).slice(0, 10)}`,
        entityType: "vendor",
        entityId: Number(row.id),
      },
      { skipAudit: true }
    );
    created.push(note);
  }

  return {
    createdCount: created.length,
    reminderDaysAhead: days,
    items: created,
  };
}

module.exports = {
  createNotification,
  createNotificationRecord,
  notificationExists,
  listNotifications,
  getNotificationById,
  markRead,
  markAllRead,
  deleteNotification,
  processReminders,
  notifyEvent,
  DEFAULT_REMINDER_DAYS,
};
