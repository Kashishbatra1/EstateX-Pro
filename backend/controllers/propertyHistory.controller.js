const propertyHistoryService = require("../services/propertyHistory.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const listForProperty = asyncHandler(async (req, res) => {
  const result = await propertyHistoryService.listHistoryForProperty(
    req.params.propertyId,
    req.query
  );
  return success(res, 200, "Property history retrieved", result);
});

module.exports = {
  listForProperty,
};
