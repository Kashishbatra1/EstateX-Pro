/**
 * Property transfer / resale API ↔ DB mapping (approved property_transfers table).
 */
const TRANSFER_TYPES = ["resale", "transfer"];

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toPublicTransfer(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    propertyId: Number(row.property_id),
    propertyCode: row.property_code || null,
    propertyTitle: row.property_title || null,
    propertyStatus: row.property_status || null,
    transferType: row.transfer_type,
    fromOwnerId:
      row.from_owner_id !== null && row.from_owner_id !== undefined
        ? Number(row.from_owner_id)
        : null,
    fromOwnerName: row.from_owner_name || null,
    toOwnerId:
      row.to_owner_id !== null && row.to_owner_id !== undefined
        ? Number(row.to_owner_id)
        : null,
    toOwnerName: row.to_owner_name || null,
    fromClientId:
      row.from_client_id !== null && row.from_client_id !== undefined
        ? Number(row.from_client_id)
        : null,
    fromClientName: row.from_client_name || null,
    toClientId:
      row.to_client_id !== null && row.to_client_id !== undefined
        ? Number(row.to_client_id)
        : null,
    toClientName: row.to_client_name || null,
    transferCharges: toNumberOrNull(row.transfer_charges) ?? 0,
    leaseCharges: toNumberOrNull(row.lease_charges) ?? 0,
    transferTax: toNumberOrNull(row.transfer_tax) ?? 0,
    stampDuty: toNumberOrNull(row.stamp_duty) ?? 0,
    nocForTransfer: Boolean(row.noc_for_transfer),
    nocStatus: row.noc_status || null,
    nocDocumentPath: row.noc_document_path || null,
    transferDate: row.transfer_date
      ? String(row.transfer_date).slice(0, 10)
      : null,
    previousOwnerSnapshot: row.previous_owner_snapshot || null,
    notes: row.notes || null,
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
  };
}

module.exports = {
  TRANSFER_TYPES,
  toPublicTransfer,
};
