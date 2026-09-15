const expenseService = require("../services/expense.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const create = asyncHandler(async (req, res) => {
  const expense = await expenseService.createExpense(req.body, req.auth.adminId);
  return success(res, 201, "Expense created", { expense });
});

const list = asyncHandler(async (req, res) => {
  const result = await expenseService.listExpenses(req.query);
  return success(res, 200, "Expenses retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const expense = await expenseService.getExpenseById(req.params.id);
  return success(res, 200, "Expense retrieved", { expense });
});

const update = asyncHandler(async (req, res) => {
  const expense = await expenseService.updateExpense(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Expense updated", { expense });
});

const changeApproval = asyncHandler(async (req, res) => {
  const expense = await expenseService.changeApprovalStatus(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Expense approval status updated", { expense });
});

const remove = asyncHandler(async (req, res) => {
  const expense = await expenseService.softDeleteExpense(req.params.id, req.auth.adminId);
  return success(res, 200, "Expense moved to recycle bin", { expense });
});

module.exports = {
  create,
  list,
  getById,
  update,
  changeApproval,
  remove,
};
