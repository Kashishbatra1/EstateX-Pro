/**
 * Booking API ↔ DB mapping and status workflow helpers.
 */
const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed"];

const ALLOWED_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  cancelled: [],
  completed: [],
};

const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"];

function toDateOnly(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const uy = value.getUTCFullYear();
    const um = String(value.getUTCMonth() + 1).padStart(2, "0");
    const ud = String(value.getUTCDate()).padStart(2, "0");
    return `${uy}-${um}-${ud}`;
  }
  return String(value).slice(0, 10);
}

function toPublicInstallment(row) {
  return {
    id: Number(row.id),
    bookingId: Number(row.booking_id),
    installmentNumber: Number(row.installment_number),
    dueDate: toDateOnly(row.due_date),
    amountDue: Number(row.amount_due),
    amountPaid: Number(row.amount_paid),
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublicBooking(row, extras = {}) {
  if (!row) return null;
  return {
    id: Number(row.id),
    bookingCode: row.booking_code,
    propertyId: Number(row.property_id),
    clientId: Number(row.client_id),
    propertyCode: row.property_code || null,
    propertyTitle: row.property_title || null,
    propertyStatus: row.property_status || null,
    clientName: row.client_name || null,
    bookingAmount: Number(row.booking_amount),
    totalPrice: Number(row.total_price),
    remainingBalance: Number(row.remaining_balance),
    installmentPlanName: row.installment_plan_name,
    monthlyInstallmentAmount:
      row.monthly_installment_amount !== null
        ? Number(row.monthly_installment_amount)
        : null,
    status: row.status,
    cancellationReason: row.cancellation_reason,
    refundAmount: row.refund_amount !== null ? Number(row.refund_amount) : null,
    refundDetails: row.refund_details,
    tokenReceiptNumber: row.token_receipt_number,
    bookingExpiryDate: toDateOnly(row.booking_expiry_date),
    digitalAgreementUrl: row.digital_agreement_url,
    bookedAt: row.booked_at,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    ...extras,
  };
}

const BOOKING_WRITABLE_FIELDS = {
  tokenReceiptNumber: "token_receipt_number",
  bookingExpiryDate: "booking_expiry_date",
  digitalAgreementUrl: "digital_agreement_url",
  installmentPlanName: "installment_plan_name",
  monthlyInstallmentAmount: "monthly_installment_amount",
  cancellationReason: "cancellation_reason",
  refundAmount: "refund_amount",
  refundDetails: "refund_details",
};

module.exports = {
  BOOKING_STATUSES,
  ALLOWED_TRANSITIONS,
  ACTIVE_BOOKING_STATUSES,
  BOOKING_WRITABLE_FIELDS,
  toPublicBooking,
  toPublicInstallment,
  toDateOnly,
};
