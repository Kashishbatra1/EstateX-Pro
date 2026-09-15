const maintenanceService = require("../services/maintenance.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const list = asyncHandler(async (req, res) => {
  const result = await maintenanceService.listTasks(req.query);
  return success(res, 200, "Maintenance tasks retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const task = await maintenanceService.getTaskById(req.params.id);
  return success(res, 200, "Maintenance task retrieved", { task });
});

const create = asyncHandler(async (req, res) => {
  const task = await maintenanceService.createTask(req.body, req.auth.adminId);
  return success(res, 201, "Maintenance task created", { task });
});

const update = asyncHandler(async (req, res) => {
  const task = await maintenanceService.updateTask(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Maintenance task updated", { task });
});

const remove = asyncHandler(async (req, res) => {
  const task = await maintenanceService.softDeleteTask(
    req.params.id,
    req.auth.adminId
  );
  return success(res, 200, "Maintenance task moved to recycle bin", { task });
});

const processReminders = asyncHandler(async (req, res) => {
  const result = await maintenanceService.processDeadlineReminders(
    req.auth.adminId
  );
  return success(res, 200, "Maintenance deadline reminders processed", result);
});

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  processReminders,
};
