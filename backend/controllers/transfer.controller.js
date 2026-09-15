const transferService = require("../services/transfer.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const create = asyncHandler(async (req, res) => {
  const transfer = await transferService.createTransfer(
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Transfer created", { transfer });
});

const list = asyncHandler(async (req, res) => {
  const result = await transferService.listTransfers(req.query);
  return success(res, 200, "Transfers retrieved", result);
});

const listForProperty = asyncHandler(async (req, res) => {
  const result = await transferService.listTransfersForProperty(
    req.params.propertyId
  );
  return success(res, 200, "Transfers retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const transfer = await transferService.getTransferById(req.params.id);
  return success(res, 200, "Transfer retrieved", { transfer });
});

const update = asyncHandler(async (req, res) => {
  const transfer = await transferService.updateTransfer(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Transfer updated", { transfer });
});

const remove = asyncHandler(async (req, res) => {
  const transfer = await transferService.softDeleteTransfer(
    req.params.id,
    req.auth.adminId
  );
  return success(res, 200, "Transfer moved to recycle bin", { transfer });
});

module.exports = {
  create,
  list,
  listForProperty,
  getById,
  update,
  remove,
};
