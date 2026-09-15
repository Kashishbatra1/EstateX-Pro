const bankService = require("../services/bank.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

/* Payment methods */
const listPaymentMethods = asyncHandler(async (req, res) => {
  const result = await bankService.listPaymentMethods(req.query);
  return success(res, 200, "Payment methods retrieved", result);
});

const getPaymentMethod = asyncHandler(async (req, res) => {
  const paymentMethod = await bankService.getPaymentMethodById(req.params.id);
  return success(res, 200, "Payment method retrieved", { paymentMethod });
});

const createPaymentMethod = asyncHandler(async (req, res) => {
  const paymentMethod = await bankService.createPaymentMethod(req.body);
  return success(res, 201, "Payment method created", { paymentMethod });
});

const updatePaymentMethod = asyncHandler(async (req, res) => {
  const paymentMethod = await bankService.updatePaymentMethod(req.params.id, req.body);
  return success(res, 200, "Payment method updated", { paymentMethod });
});

/* Bank accounts */
const createBankAccount = asyncHandler(async (req, res) => {
  const bankAccount = await bankService.createBankAccount(req.body);
  return success(res, 201, "Bank account created", { bankAccount });
});

const listBankAccounts = asyncHandler(async (req, res) => {
  const result = await bankService.listBankAccounts(req.query);
  return success(res, 200, "Bank accounts retrieved", result);
});

const getBankAccount = asyncHandler(async (req, res) => {
  const bankAccount = await bankService.getBankAccountById(req.params.id);
  return success(res, 200, "Bank account retrieved", { bankAccount });
});

const updateBankAccount = asyncHandler(async (req, res) => {
  const bankAccount = await bankService.updateBankAccount(req.params.id, req.body);
  return success(res, 200, "Bank account updated", { bankAccount });
});

const deleteBankAccount = asyncHandler(async (req, res) => {
  const result = await bankService.softDeleteBankAccount(req.params.id, req.auth.adminId);
  return success(res, 200, "Bank account moved to recycle bin", { bankAccount: result });
});

/* Property bank links */
const listForProperty = asyncHandler(async (req, res) => {
  const result = await bankService.listPropertyBankAccounts(req.params.propertyId);
  return success(res, 200, "Property bank accounts retrieved", result);
});

const linkToProperty = asyncHandler(async (req, res) => {
  const link = await bankService.linkBankAccountToProperty(
    req.params.propertyId,
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Bank account linked to property", { link });
});

const updatePropertyLink = asyncHandler(async (req, res) => {
  const link = await bankService.updatePropertyBankLink(
    req.params.propertyId,
    req.params.bankAccountId,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Property bank link updated", { link });
});

const unlinkFromProperty = asyncHandler(async (req, res) => {
  const result = await bankService.unlinkBankAccountFromProperty(
    req.params.propertyId,
    req.params.bankAccountId,
    req.auth.adminId
  );
  return success(res, 200, "Bank account unlinked from property", result);
});

module.exports = {
  listPaymentMethods,
  getPaymentMethod,
  createPaymentMethod,
  updatePaymentMethod,
  createBankAccount,
  listBankAccounts,
  getBankAccount,
  updateBankAccount,
  deleteBankAccount,
  listForProperty,
  linkToProperty,
  updatePropertyLink,
  unlinkFromProperty,
};
