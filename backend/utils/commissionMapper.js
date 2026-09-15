/**
 * Commission / Brokerage API ↔ DB mapping (approved commissions table).
 */
const PAYMENT_STATUSES = ["unpaid", "partial", "paid"];

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toPublicCommission(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    propertyId: Number(row.property_id),
    bookingId: row.booking_id !== null ? Number(row.booking_id) : null,
    propertyCode: row.property_code || null,
    propertyTitle: row.property_title || null,
    propertyStatus: row.property_status || null,
    bookingCode: row.booking_code || null,
    bookingStatus: row.booking_status || null,
    clientId: row.client_id !== null && row.client_id !== undefined ? Number(row.client_id) : null,
    clientName: row.client_name || null,
    baseAmount:
      row.base_amount !== null && row.base_amount !== undefined
        ? Number(row.base_amount)
        : null,
    commissionPercentage: toNumberOrNull(row.commission_percentage),
    calculatedAmount: toNumberOrNull(row.calculated_amount),
    finalAmount: toNumberOrNull(row.final_amount),
    isManualOverride: Boolean(row.is_manual_override),
    overrideReason: row.override_reason || null,
    brokerageFromBuyer: toNumberOrNull(row.brokerage_from_buyer) ?? 0,
    brokerageFromSeller: toNumberOrNull(row.brokerage_from_seller) ?? 0,
    paymentStatus: row.payment_status,
    assignedAgentId:
      row.assigned_agent_id !== null && row.assigned_agent_id !== undefined
        ? Number(row.assigned_agent_id)
        : null,
    assignedAgentName: row.assigned_agent_name || null,
    referralSource: row.referral_source || null,
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
  };
}

module.exports = {
  PAYMENT_STATUSES,
  roundMoney,
  toPublicCommission,
};
