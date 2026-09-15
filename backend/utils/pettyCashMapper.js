/**
 * Petty Cash — accounts, transactions (in/out), reconciliations.
 */

const TXN_TYPES = ["in", "out"];

const ACCOUNT_WRITABLE = {
  accountName: "account_name",
  custodianEmployeeId: "custodian_employee_id",
  floatAmount: "float_amount",
  isActive: "is_active",
  notes: "notes",
};

function toPublicAccount(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    accountName: row.account_name,
    custodianEmployeeId: Number(row.custodian_employee_id),
    custodianName: row.custodian_name || null,
    floatAmount: Number(row.float_amount),
    currentBalance: Number(row.current_balance),
    isActive: Boolean(row.is_active),
    notes: row.notes || null,
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublicTxn(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    accountId: Number(row.account_id),
    txnType: row.txn_type,
    amount: Number(row.amount),
    expenseId: row.expense_id != null ? Number(row.expense_id) : null,
    description: row.description || null,
    txnDate: row.txn_date
      ? String(row.txn_date).slice(0, 10)
      : null,
    performedBy: row.performed_by != null ? Number(row.performed_by) : null,
    performedByName: row.performed_by_name || null,
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdAt: row.created_at,
  };
}

function toPublicReconciliation(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    accountId: Number(row.account_id),
    reconciledOn: row.reconciled_on
      ? String(row.reconciled_on).slice(0, 10)
      : null,
    systemBalance: Number(row.system_balance),
    countedBalance: Number(row.counted_balance),
    variance: Number(row.variance),
    notes: row.notes || null,
    reconciledBy: row.reconciled_by != null ? Number(row.reconciled_by) : null,
    reconciledByName: row.reconciled_by_name || null,
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdAt: row.created_at,
  };
}

module.exports = {
  TXN_TYPES,
  ACCOUNT_WRITABLE,
  toPublicAccount,
  toPublicTxn,
  toPublicReconciliation,
};
