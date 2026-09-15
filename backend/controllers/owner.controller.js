const ownerService = require("../services/owner.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const create = asyncHandler(async (req, res) => {
  const owner = await ownerService.createOwner(req.body);
  return success(res, 201, "Owner created", { owner });
});

const list = asyncHandler(async (req, res) => {
  const result = await ownerService.listOwners(req.query);
  return success(res, 200, "Owners retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const owner = await ownerService.getOwnerById(req.params.id);
  return success(res, 200, "Owner retrieved", { owner });
});

const update = asyncHandler(async (req, res) => {
  const owner = await ownerService.updateOwner(req.params.id, req.body);
  return success(res, 200, "Owner updated", { owner });
});

const verify = asyncHandler(async (req, res) => {
  const owner = await ownerService.updateVerificationStatus(
    req.params.id,
    req.body.verificationStatus,
    req.auth.adminId
  );
  return success(res, 200, "Owner verification updated", { owner });
});

const remove = asyncHandler(async (req, res) => {
  const result = await ownerService.softDeleteOwner(req.params.id, req.auth.adminId);
  return success(res, 200, "Owner moved to recycle bin", { owner: result });
});

const listForProperty = asyncHandler(async (req, res) => {
  const result = await ownerService.listPropertyOwners(req.params.propertyId);
  return success(res, 200, "Property owners retrieved", result);
});

const linkToProperty = asyncHandler(async (req, res) => {
  const link = await ownerService.linkOwnerToProperty(
    req.params.propertyId,
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Owner linked to property", { link });
});

const updateShare = asyncHandler(async (req, res) => {
  const link = await ownerService.updatePropertyOwnerShare(
    req.params.propertyId,
    req.params.ownerId,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Ownership share updated", { link });
});

const unlinkFromProperty = asyncHandler(async (req, res) => {
  const result = await ownerService.unlinkOwnerFromProperty(
    req.params.propertyId,
    req.params.ownerId,
    req.auth.adminId
  );
  return success(res, 200, "Owner unlinked from property", result);
});

module.exports = {
  create,
  list,
  getById,
  update,
  verify,
  remove,
  listForProperty,
  linkToProperty,
  updateShare,
  unlinkFromProperty,
};
