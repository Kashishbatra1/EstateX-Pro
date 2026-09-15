const inventoryService = require("../services/inventory.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const list = asyncHandler(async (req, res) => {
  const result = await inventoryService.listInventoryItems(req.query);
  return success(res, 200, "Inventory items retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const item = await inventoryService.getInventoryItemById(req.params.id);
  return success(res, 200, "Inventory item retrieved", { item });
});

const create = asyncHandler(async (req, res) => {
  const item = await inventoryService.createInventoryItem(
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Inventory item created", { item });
});

const update = asyncHandler(async (req, res) => {
  const item = await inventoryService.updateInventoryItem(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Inventory item updated", { item });
});

const assign = asyncHandler(async (req, res) => {
  const item = await inventoryService.assignInventoryItem(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Inventory item assigned", { item });
});

const returnItem = asyncHandler(async (req, res) => {
  const item = await inventoryService.returnInventoryItem(
    req.params.id,
    req.body || {},
    req.auth.adminId
  );
  return success(res, 200, "Inventory item returned to stock", { item });
});

const adjust = asyncHandler(async (req, res) => {
  const item = await inventoryService.adjustInventoryQuantity(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Inventory quantity adjusted", { item });
});

const listTransactions = asyncHandler(async (req, res) => {
  const result = await inventoryService.listTransactions(req.params.id);
  return success(res, 200, "Inventory transactions retrieved", result);
});

const remove = asyncHandler(async (req, res) => {
  const item = await inventoryService.softDeleteInventoryItem(
    req.params.id,
    req.auth.adminId
  );
  return success(res, 200, "Inventory item moved to recycle bin", { item });
});

const listEmployees = asyncHandler(async (req, res) => {
  const result = await inventoryService.listEmployees();
  return success(res, 200, "Employees retrieved", result);
});

module.exports = {
  list,
  getById,
  create,
  update,
  assign,
  returnItem,
  adjust,
  listTransactions,
  remove,
  listEmployees,
};
