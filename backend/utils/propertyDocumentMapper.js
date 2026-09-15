/**
 * Property documents & media — API camelCase mapping over approved schema enums.
 */

const DOCUMENT_TYPES = [
  "registry",
  "agreement",
  "tax_file",
  "lease_certificate",
  "other",
];

const MEDIA_TYPES = ["image", "video", "floor_plan"];

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toPublicDocument(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    propertyId: Number(row.property_id),
    documentType: row.document_type,
    documentName: row.document_name,
    filePath: row.file_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    uploadDate: toDateOnly(row.upload_date),
    expiryDate: toDateOnly(row.expiry_date),
    notes: row.notes,
    uploadedBy: row.uploaded_by ? Number(row.uploaded_by) : null,
    uploadedByName: row.uploaded_by_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
  };
}

function toPublicMedia(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    propertyId: Number(row.property_id),
    mediaType: row.media_type,
    filePath: row.file_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    caption: row.caption,
    sortOrder: Number(row.sort_order) || 0,
    isCover: Boolean(row.is_cover),
    uploadedBy: row.uploaded_by ? Number(row.uploaded_by) : null,
    uploadedByName: row.uploaded_by_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
  };
}

module.exports = {
  DOCUMENT_TYPES,
  MEDIA_TYPES,
  toPublicDocument,
  toPublicMedia,
  toDateOnly,
};
