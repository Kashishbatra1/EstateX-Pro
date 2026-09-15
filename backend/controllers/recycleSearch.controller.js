const recycleBinService = require("../services/recycleBin.service");
const searchService = require("../services/search.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const listRecycleBin = asyncHandler(async (req, res) => {
  const result = await recycleBinService.listRecycleBin(req.query);
  return success(res, 200, "Recycle bin retrieved", result);
});

const restore = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.body || {};
  const result = await recycleBinService.restoreEntity(
    req.auth.adminId,
    entityType,
    entityId
  );
  return success(res, 200, "Item restored", result);
});

const purge = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.body || {};
  const result = await recycleBinService.purgeEntity(
    req.auth.adminId,
    entityType,
    entityId
  );
  return success(res, 200, "Item permanently deleted", result);
});

const search = asyncHandler(async (req, res) => {
  const result = await searchService.globalSearch(req.query.q);
  return success(res, 200, "Search results", result);
});

module.exports = { listRecycleBin, restore, purge, search };
