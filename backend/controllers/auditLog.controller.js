const auditLogService = require("../services/auditLog.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

const list = asyncHandler(async (req, res) => {
  const result = await auditLogService.listAuditLogs(req.query);
  return success(res, 200, "Audit logs retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Invalid id");
  }
  const auditLog = await auditLogService.getAuditLogById(id);
  return success(res, 200, "Audit log retrieved", { auditLog });
});

module.exports = { list, getById };
