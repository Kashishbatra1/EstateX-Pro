/**
 * Vendor Management — API mapping over approved vendors / payments / documents.
 */

function toDateOnly(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

const WRITABLE_FIELDS = {
  vendorName: "vendor_name",
  contactPerson: "contact_person",
  phone: "phone",
  email: "email",
  address: "address",
  services: "services",
  contractStartDate: "contract_start_date",
  contractEndDate: "contract_end_date",
  paymentTerms: "payment_terms",
  isPreferred: "is_preferred",
  outstandingBalance: "outstanding_balance",
  notes: "notes",
};

function toPublicVendor(row, extras = {}) {
  if (!row) return null;
  return {
    id: Number(row.id),
    vendorName: row.vendor_name,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    address: row.address,
    services: row.services,
    contractStartDate: toDateOnly(row.contract_start_date),
    contractEndDate: toDateOnly(row.contract_end_date),
    paymentTerms: row.payment_terms,
    isPreferred: Boolean(row.is_preferred),
    outstandingBalance: Number(row.outstanding_balance),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    ...extras,
  };
}

function toPublicVendorPayment(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    vendorId: Number(row.vendor_id),
    amount: Number(row.amount),
    paymentDate: toDateOnly(row.payment_date),
    paymentMethodId: row.payment_method_id
      ? Number(row.payment_method_id)
      : null,
    paymentMethodName: row.payment_method_name || null,
    referenceNumber: row.reference_number,
    notes: row.notes,
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdAt: row.created_at,
  };
}

function toPublicVendorDocument(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    vendorId: Number(row.vendor_id),
    documentName: row.document_name,
    documentType: row.document_type,
    filePath: row.file_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    uploadDate: toDateOnly(row.upload_date),
    expiryDate: toDateOnly(row.expiry_date),
    uploadedBy: row.uploaded_by ? Number(row.uploaded_by) : null,
    createdAt: row.created_at,
    deletedAt: row.deleted_at || null,
  };
}

module.exports = {
  WRITABLE_FIELDS,
  toPublicVendor,
  toPublicVendorPayment,
  toPublicVendorDocument,
  toDateOnly,
};
