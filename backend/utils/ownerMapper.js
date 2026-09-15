/**
 * Map between API (camelCase) and PostgreSQL owners columns.
 */
const VERIFICATION_VALUES = ["unverified", "verified", "rejected"];

const WRITABLE_FIELDS = {
  ownerName: "owner_name",
  cnic: "cnic",
  phone: "phone",
  email: "email",
  address: "address",
  ntn: "ntn",
  nomineeName: "nominee_name",
  nomineeCnic: "nominee_cnic",
  nomineeRelation: "nominee_relation",
  nomineeContact: "nominee_contact",
  poaHolderName: "poa_holder_name",
  poaDetails: "poa_details",
  poaDocumentPath: "poa_document_path",
  notes: "notes",
};

function toPublicOwner(row, extras = {}) {
  if (!row) return null;
  return {
    id: Number(row.id),
    ownerName: row.owner_name,
    cnic: row.cnic,
    phone: row.phone,
    email: row.email,
    address: row.address,
    ntn: row.ntn,
    nomineeName: row.nominee_name,
    nomineeCnic: row.nominee_cnic,
    nomineeRelation: row.nominee_relation,
    nomineeContact: row.nominee_contact,
    poaHolderName: row.poa_holder_name,
    poaDetails: row.poa_details,
    poaDocumentPath: row.poa_document_path,
    verificationStatus: row.verification_status,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by ? Number(row.verified_by) : null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    ...extras,
  };
}

function toPublicPropertyOwnerLink(row) {
  return {
    id: Number(row.id),
    propertyId: Number(row.property_id),
    ownerId: Number(row.owner_id),
    ownerName: row.owner_name,
    verificationStatus: row.verification_status,
    sharePercentage: Number(row.share_percentage),
    ownershipDocumentType: row.ownership_document_type,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
  };
}

module.exports = {
  VERIFICATION_VALUES,
  WRITABLE_FIELDS,
  toPublicOwner,
  toPublicPropertyOwnerLink,
};
