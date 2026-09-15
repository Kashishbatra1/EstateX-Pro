const backupService = require("../services/backup.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const list = asyncHandler(async (req, res) => {
  const result = await backupService.listBackups();
  return success(res, 200, "Backups retrieved", result);
});

const create = asyncHandler(async (req, res) => {
  const backup = await backupService.createBackup(req.auth.adminId, req.body || {});
  return success(res, 201, "Backup created", { backup });
});

const restore = asyncHandler(async (req, res) => {
  const backup = await backupService.markRestored(
    Number(req.params.id),
    req.auth.adminId
  );
  return success(res, 200, "Backup marked restored", { backup });
});

module.exports = { list, create, restore };
