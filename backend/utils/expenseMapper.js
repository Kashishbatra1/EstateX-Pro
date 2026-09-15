/**
 * Expense API ↔ DB mapping helpers.
 */
const APPROVAL_STATUSES = ["requested", "approved", "rejected"];
const REIMBURSEMENT_STATUSES = ["none", "pending", "reimbursed"];

const ALLOWED_APPROVAL_TRANSITIONS = {
  requested: ["approved", "rejected"],
  approved: [],
  rejected: [],
};

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

function toPublicExpense(row, extras = {}) {
  if (!row) return null;
  return {
    id: Number(row.id),
    expenseCode: row.expense_code,
    expenseDate: toDateOnly(row.expense_date),
    categoryId: Number(row.category_id),
    categoryName: row.category_name || null,
    subcategoryId: row.subcategory_id !== null ? Number(row.subcategory_id) : null,
    subcategoryName: row.subcategory_name || null,
    vendorId: row.vendor_id !== null ? Number(row.vendor_id) : null,
    vendorName: row.vendor_name || null,
    amount: Number(row.amount),
    gstSalesTax: Number(row.gst_sales_tax),
    remainingAmount: Number(row.remaining_amount),
    paymentMethodId:
      row.payment_method_id !== null && row.payment_method_id !== undefined
        ? Number(row.payment_method_id)
        : null,
    paymentMethodName: row.payment_method_name || null,
    description: row.description,
    paidByEmployeeId: Number(row.paid_by_employee_id),
    paidByEmployeeName: row.paid_by_employee_name || null,
    deviceOrItemName: row.device_or_item_name,
    quantity: row.quantity !== null && row.quantity !== undefined ? Number(row.quantity) : null,
    receiptPath: row.receipt_path,
    reimbursementStatus: row.reimbursement_status,
    approvalStatus: row.approval_status,
    approvedBy: row.approved_by !== null && row.approved_by !== undefined
      ? Number(row.approved_by)
      : null,
    approvedAt: row.approved_at || null,
    rejectionReason: row.rejection_reason,
    inventoryItemId:
      row.inventory_item_id !== null && row.inventory_item_id !== undefined
        ? Number(row.inventory_item_id)
        : null,
    propertyId:
      row.property_id !== null && row.property_id !== undefined
        ? Number(row.property_id)
        : null,
    propertyCode: row.property_code || null,
    createdBy: row.created_by !== null && row.created_by !== undefined
      ? Number(row.created_by)
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    ...extras,
  };
}

const EXPENSE_WRITABLE_FIELDS = {
  expenseDate: "expense_date",
  categoryId: "category_id",
  subcategoryId: "subcategory_id",
  vendorId: "vendor_id",
  amount: "amount",
  gstSalesTax: "gst_sales_tax",
  remainingAmount: "remaining_amount",
  paymentMethodId: "payment_method_id",
  description: "description",
  paidByEmployeeId: "paid_by_employee_id",
  deviceOrItemName: "device_or_item_name",
  quantity: "quantity",
  receiptPath: "receipt_path",
  reimbursementStatus: "reimbursement_status",
  propertyId: "property_id",
};

module.exports = {
  APPROVAL_STATUSES,
  REIMBURSEMENT_STATUSES,
  ALLOWED_APPROVAL_TRANSITIONS,
  EXPENSE_WRITABLE_FIELDS,
  toPublicExpense,
  toDateOnly,
};
