/**
 * Map between API and PostgreSQL bank_accounts / payment_methods.
 */
function toPublicBankAccount(row, extras = {}) {
  if (!row) return null;
  return {
    id: Number(row.id),
    bankName: row.bank_name,
    accountHolderName: row.account_holder_name,
    accountNumber: row.account_number,
    iban: row.iban,
    branchName: row.branch_name,
    accountDetails: row.account_details,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    ...extras,
  };
}

function toPublicPaymentMethod(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    methodName: row.method_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublicPropertyBankLink(row) {
  return {
    id: Number(row.id),
    propertyId: Number(row.property_id),
    bankAccountId: Number(row.bank_account_id),
    bankName: row.bank_name,
    accountHolderName: row.account_holder_name,
    accountNumber: row.account_number,
    isActive: row.is_active,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
  };
}

const BANK_WRITABLE_FIELDS = {
  bankName: "bank_name",
  accountHolderName: "account_holder_name",
  accountNumber: "account_number",
  iban: "iban",
  branchName: "branch_name",
  accountDetails: "account_details",
  isActive: "is_active",
};

module.exports = {
  toPublicBankAccount,
  toPublicPaymentMethod,
  toPublicPropertyBankLink,
  BANK_WRITABLE_FIELDS,
};
