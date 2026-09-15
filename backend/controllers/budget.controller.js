const budgetService = require("../services/budget.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const list = asyncHandler(async (req, res) => {
  const result = await budgetService.listBudgets(req.query);
  return success(res, 200, "Budgets retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const budget = await budgetService.getBudgetById(req.params.id);
  return success(res, 200, "Budget retrieved", { budget });
});

const create = asyncHandler(async (req, res) => {
  const budget = await budgetService.createBudget(req.body, req.auth.adminId);
  return success(res, 201, "Budget created", { budget });
});

const update = asyncHandler(async (req, res) => {
  const budget = await budgetService.updateBudget(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Budget updated", { budget });
});

const remove = asyncHandler(async (req, res) => {
  const budget = await budgetService.softDeleteBudget(
    req.params.id,
    req.auth.adminId
  );
  return success(res, 200, "Budget moved to recycle bin", { budget });
});

const addLine = asyncHandler(async (req, res) => {
  const line = await budgetService.addBudgetLine(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Budget line created", { line });
});

const updateLine = asyncHandler(async (req, res) => {
  const line = await budgetService.updateBudgetLine(
    req.params.id,
    req.params.lineId,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Budget line updated", { line });
});

const removeLine = asyncHandler(async (req, res) => {
  const result = await budgetService.deleteBudgetLine(
    req.params.id,
    req.params.lineId,
    req.auth.adminId
  );
  return success(res, 200, "Budget line deleted", result);
});

const processAlerts = asyncHandler(async (req, res) => {
  const result = await budgetService.processOverspendAlerts(req.auth.adminId);
  return success(res, 200, "Budget overspend alerts processed", result);
});

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  addLine,
  updateLine,
  removeLine,
  processAlerts,
};
