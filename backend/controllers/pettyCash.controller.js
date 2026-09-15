const pettyCashService = require("../services/pettyCash.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const list = asyncHandler(async (req, res) => {
  const result = await pettyCashService.listAccounts(req.query);
  return success(res, 200, "Petty cash accounts retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const account = await pettyCashService.getAccountById(req.params.id);
  return success(res, 200, "Petty cash account retrieved", { account });
});

const create = asyncHandler(async (req, res) => {
  const account = await pettyCashService.createAccount(req.body, req.auth.adminId);
  return success(res, 201, "Petty cash account created", { account });
});

const update = asyncHandler(async (req, res) => {
  const account = await pettyCashService.updateAccount(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Petty cash account updated", { account });
});

const remove = asyncHandler(async (req, res) => {
  const account = await pettyCashService.softDeleteAccount(
    req.params.id,
    req.auth.adminId
  );
  return success(res, 200, "Petty cash account moved to recycle bin", { account });
});

const listTxns = asyncHandler(async (req, res) => {
  const result = await pettyCashService.listTransactions(req.params.id, req.query);
  return success(res, 200, "Petty cash transactions retrieved", result);
});

const createTxn = asyncHandler(async (req, res) => {
  const result = await pettyCashService.createTransaction(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Petty cash transaction recorded", result);
});

const listRecons = asyncHandler(async (req, res) => {
  const result = await pettyCashService.listReconciliations(req.params.id, req.query);
  return success(res, 200, "Petty cash reconciliations retrieved", result);
});

const createRecon = asyncHandler(async (req, res) => {
  const reconciliation = await pettyCashService.createReconciliation(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Petty cash reconciliation recorded", { reconciliation });
});

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  listTxns,
  createTxn,
  listRecons,
  createRecon,
};
