const visitService = require("../services/propertyVisit.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const list = asyncHandler(async (req, res) => {
  const items = await visitService.listPropertyVisits(
    Number(req.params.propertyId)
  );
  return success(res, 200, "Property visits retrieved", { items });
});

const create = asyncHandler(async (req, res) => {
  const visit = await visitService.createPropertyVisit(
    Number(req.params.propertyId),
    req.body || {},
    req.auth.adminId
  );
  return success(res, 201, "Property visit scheduled", { visit });
});

const update = asyncHandler(async (req, res) => {
  const visit = await visitService.updatePropertyVisit(
    Number(req.params.propertyId),
    Number(req.params.visitId),
    req.body || {}
  );
  return success(res, 200, "Property visit updated", { visit });
});

const remove = asyncHandler(async (req, res) => {
  const result = await visitService.deletePropertyVisit(
    Number(req.params.propertyId),
    Number(req.params.visitId),
    req.auth.adminId
  );
  return success(res, 200, "Property visit removed", { visit: result });
});

module.exports = { list, create, update, remove };
