/**
 * Payment API ↔ DB mapping helpers.
 * Schema: payments has no status column; soft-delete represents reversal.
 */
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

function toPublicPayment(row, extras = {}) {
  if (!row) return null;
  return {
    id: Number(row.id),
    paymentCode: row.payment_code,
    bookingId: Number(row.booking_id),
    installmentId: row.installment_id !== null ? Number(row.installment_id) : null,
    amount: Number(row.amount),
    paymentDate: toDateOnly(row.payment_date),
    paymentMethodId:
      row.payment_method_id !== null && row.payment_method_id !== undefined
        ? Number(row.payment_method_id)
        : null,
    paymentMethodName: row.payment_method_name || null,
    bankAccountId:
      row.bank_account_id !== null && row.bank_account_id !== undefined
        ? Number(row.bank_account_id)
        : null,
    bankName: row.bank_name || null,
    referenceNumber: row.reference_number,
    notes: row.notes,
    receivedBy: row.received_by !== null && row.received_by !== undefined
      ? Number(row.received_by)
      : null,
    createdBy: row.created_by !== null && row.created_by !== undefined
      ? Number(row.created_by)
      : null,
    bookingCode: row.booking_code || null,
    bookingStatus: row.booking_status || null,
    propertyId: row.property_id !== null && row.property_id !== undefined
      ? Number(row.property_id)
      : null,
    propertyCode: row.property_code || null,
    clientId: row.client_id !== null && row.client_id !== undefined
      ? Number(row.client_id)
      : null,
    clientName: row.client_name || null,
    remainingBalanceAfter:
      row.remaining_balance !== null && row.remaining_balance !== undefined
        ? Number(row.remaining_balance)
        : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    ...extras,
  };
}

const PAYMENT_METADATA_FIELDS = {
  referenceNumber: "reference_number",
  notes: "notes",
  paymentDate: "payment_date",
  paymentMethodId: "payment_method_id",
  bankAccountId: "bank_account_id",
  receivedBy: "received_by",
};

module.exports = {
  toPublicPayment,
  toDateOnly,
  PAYMENT_METADATA_FIELDS,
};
