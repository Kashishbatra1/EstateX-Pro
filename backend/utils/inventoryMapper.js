/**
 * Office Inventory — API mapping over approved inventory_items / inventory_transactions.
 */

const INVENTORY_STATUSES = ["in_stock", "assigned", "maintenance", "retired"];
const INVENTORY_TXN_TYPES = ["purchase", "assign", "return", "adjust", "retire"];

function toDateOnly(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function toPublicInventoryItem(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    itemName: row.item_name,
    itemType: row.item_type,
    quantity: Number(row.quantity),
    unit: row.unit,
    status: row.status,
    assignedTo: row.assigned_to ? Number(row.assigned_to) : null,
    assignedToName: row.assigned_to_name || null,
    locationNotes: row.location_notes,
    purchaseDate: toDateOnly(row.purchase_date),
    purchaseCost:
      row.purchase_cost !== null && row.purchase_cost !== undefined
        ? Number(row.purchase_cost)
        : null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
  };
}

function toPublicInventoryTransaction(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    inventoryItemId: Number(row.inventory_item_id),
    expenseId: row.expense_id ? Number(row.expense_id) : null,
    expenseCode: row.expense_code || null,
    txnType: row.txn_type,
    quantityChange: Number(row.quantity_change),
    assignedTo: row.assigned_to ? Number(row.assigned_to) : null,
    assignedToName: row.assigned_to_name || null,
    notes: row.notes,
    performedBy: row.performed_by ? Number(row.performed_by) : null,
    performedByName: row.performed_by_name || null,
    createdAt: row.created_at,
  };
}

function toPublicEmployee(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    designation: row.designation,
    isActive: row.is_active,
  };
}

module.exports = {
  INVENTORY_STATUSES,
  INVENTORY_TXN_TYPES,
  toPublicInventoryItem,
  toPublicInventoryTransaction,
  toPublicEmployee,
  toDateOnly,
};
