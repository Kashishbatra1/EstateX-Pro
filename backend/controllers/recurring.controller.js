const recurringService = require("../services/recurring.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const list = asyncHandler(async (req, res) => {
  const result = await recurringService.listRecurring(req.query);
  return success(res, 200, "Recurring expenses retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const recurringExpense = await recurringService.getRecurringById(req.params.id);
  return success(res, 200, "Recurring expense retrieved", { recurringExpense });
});

const create = asyncHandler(async (req, res) => {
  const recurringExpense = await recurringService.createRecurring(
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Recurring expense created", { recurringExpense });
});

const update = asyncHandler(async (req, res) => {
  const recurringExpense = await recurringService.updateRecurring(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Recurring expense updated", { recurringExpense });
});

const remove = asyncHandler(async (req, res) => {
  const recurringExpense = await recurringService.softDeleteRecurring(
    req.params.id,
    req.auth.adminId
  );
  return success(res, 200, "Recurring expense moved to recycle bin", {
    recurringExpense,
  });
});

const processReminders = asyncHandler(async (req, res) => {
  const result = await recurringService.processDueReminders(req.auth.adminId);
  return success(res, 200, "Recurring due reminders processed", result);
});

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  processReminders,
};
