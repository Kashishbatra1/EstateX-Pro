/**
 * Notification API ↔ DB mapping.
 * Schema types only — no invented notification types.
 */
const NOTIFICATION_TYPES = [
  "rent_due",
  "utility_bill",
  "missing_document",
  "high_expense",
  "maintenance_deadline",
  "booking_expiry",
  "budget_overspending",
  "vendor_contract_renewal",
  "document_expiry",
  "general",
];

function toPublicNotification(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    adminId: row.admin_id !== null && row.admin_id !== undefined ? Number(row.admin_id) : null,
    notificationType: row.notification_type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId:
      row.entity_id !== null && row.entity_id !== undefined ? Number(row.entity_id) : null,
    isRead: Boolean(row.is_read),
    readAt: row.read_at || null,
    createdAt: row.created_at,
  };
}

module.exports = {
  NOTIFICATION_TYPES,
  toPublicNotification,
};
