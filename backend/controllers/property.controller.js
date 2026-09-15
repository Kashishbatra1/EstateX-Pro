const propertyService = require("../services/property.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const create = asyncHandler(async (req, res) => {
  const property = await propertyService.createProperty(req.body, req.auth.adminId);
  return success(res, 201, "Property created as draft", { property });
});

const list = asyncHandler(async (req, res) => {
  const result = await propertyService.listProperties(req.query);
  return success(res, 200, "Properties retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const property = await propertyService.getPropertyById(req.params.id);
  return success(res, 200, "Property retrieved", { property });
});

const update = asyncHandler(async (req, res) => {
  const property = await propertyService.updateProperty(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Property updated", { property });
});

const changeStatus = asyncHandler(async (req, res) => {
  const property = await propertyService.changePropertyStatus(
    req.params.id,
    req.body.status,
    req.auth.adminId
  );
  return success(res, 200, "Property status updated", { property });
});

const remove = asyncHandler(async (req, res) => {
  const result = await propertyService.softDeleteProperty(
    req.params.id,
    req.auth.adminId
  );
  return success(res, 200, "Property moved to recycle bin", { property: result });
});

module.exports = {
  create,
  list,
  getById,
  update,
  changeStatus,
  remove,
};
