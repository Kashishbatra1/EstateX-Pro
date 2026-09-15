/**
 * Map property_history rows (+ optional admin join) to API camelCase.
 */

const EVENT_TYPES = [
  "created",
  "price_update",
  "ownership_change",
  "status_change",
  "media_upload",
  "document_upload",
  "commission_override",
  "transfer",
  "other",
];

function toPublicHistoryEvent(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    propertyId: Number(row.property_id),
    eventType: row.event_type,
    oldValue: row.old_value ?? null,
    newValue: row.new_value ?? null,
    description: row.description ?? null,
    performedBy: row.performed_by ? Number(row.performed_by) : null,
    performedByName: row.performed_by_name || null,
    createdAt: row.created_at,
  };
}

module.exports = {
  EVENT_TYPES,
  toPublicHistoryEvent,
};
