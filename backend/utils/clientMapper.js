/**
 * Map between API and PostgreSQL clients / CRM tables.
 */
const CLIENT_TYPES = ["buyer", "seller", "both"];
const WHATSAPP_SMS_PREFS = ["whatsapp", "sms", "both", "none"];
const COMMUNICATION_TYPES = ["call", "email", "whatsapp", "sms", "meeting", "note"];

const CLIENT_WRITABLE_FIELDS = {
  clientName: "client_name",
  cnic: "cnic",
  phone: "phone",
  email: "email",
  address: "address",
  clientType: "client_type",
  budgetMin: "budget_min",
  budgetMax: "budget_max",
  investmentPreference: "investment_preference",
  preferredPropertyType: "preferred_property_type",
  preferredLocation: "preferred_location",
  leadSource: "lead_source",
  referralSource: "referral_source",
  crmNotes: "crm_notes",
  whatsappSmsPreference: "whatsapp_sms_preference",
  clientRating: "client_rating",
  nextFollowUpDate: "next_follow_up_date",
};

function toDateOnly(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const uy = value.getUTCFullYear();
    const um = String(value.getUTCMonth() + 1).padStart(2, "0");
    const ud = String(value.getUTCDate()).padStart(2, "0");
    return `${uy}-${um}-${ud}`;
  }
  return String(value).slice(0, 10);
}

function toPublicClient(row, extras = {}) {
  if (!row) return null;
  return {
    id: Number(row.id),
    clientName: row.client_name,
    cnic: row.cnic,
    phone: row.phone,
    email: row.email,
    address: row.address,
    clientType: row.client_type,
    budgetMin: row.budget_min !== null ? Number(row.budget_min) : null,
    budgetMax: row.budget_max !== null ? Number(row.budget_max) : null,
    investmentPreference: row.investment_preference,
    preferredPropertyType: row.preferred_property_type,
    preferredLocation: row.preferred_location,
    leadSource: row.lead_source,
    referralSource: row.referral_source,
    crmNotes: row.crm_notes,
    whatsappSmsPreference: row.whatsapp_sms_preference,
    clientRating: row.client_rating !== null ? Number(row.client_rating) : null,
    nextFollowUpDate: toDateOnly(row.next_follow_up_date),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    ...extras,
  };
}

function toPublicCommunication(row) {
  return {
    id: Number(row.id),
    clientId: Number(row.client_id),
    communicationType: row.communication_type,
    subject: row.subject,
    notes: row.notes,
    communicatedAt: row.communicated_at,
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdAt: row.created_at,
  };
}

function toPublicKycDocument(row) {
  return {
    id: Number(row.id),
    clientId: Number(row.client_id),
    documentType: row.document_type,
    filePath: row.file_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    expiryDate: toDateOnly(row.expiry_date),
    uploadedAt: row.uploaded_at,
    uploadedBy: row.uploaded_by ? Number(row.uploaded_by) : null,
    createdAt: row.created_at,
    deletedAt: row.deleted_at || null,
  };
}

module.exports = {
  CLIENT_TYPES,
  WHATSAPP_SMS_PREFS,
  COMMUNICATION_TYPES,
  CLIENT_WRITABLE_FIELDS,
  toPublicClient,
  toPublicCommunication,
  toPublicKycDocument,
  toDateOnly,
};
