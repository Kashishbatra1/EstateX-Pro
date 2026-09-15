const vendorService = require("../services/vendor.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const list = asyncHandler(async (req, res) => {
  const result = await vendorService.listVendors(req.query);
  return success(res, 200, "Vendors retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const vendor = await vendorService.getVendorById(req.params.id);
  return success(res, 200, "Vendor retrieved", { vendor });
});

const create = asyncHandler(async (req, res) => {
  const vendor = await vendorService.createVendor(req.body, req.auth.adminId);
  return success(res, 201, "Vendor created", { vendor });
});

const update = asyncHandler(async (req, res) => {
  const vendor = await vendorService.updateVendor(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Vendor updated", { vendor });
});

const remove = asyncHandler(async (req, res) => {
  const vendor = await vendorService.softDeleteVendor(
    req.params.id,
    req.auth.adminId
  );
  return success(res, 200, "Vendor moved to recycle bin", { vendor });
});

const listPayments = asyncHandler(async (req, res) => {
  const result = await vendorService.listPayments(req.params.id);
  return success(res, 200, "Vendor payments retrieved", result);
});

const addPayment = asyncHandler(async (req, res) => {
  const result = await vendorService.addPayment(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Vendor payment recorded", result);
});

const listDocuments = asyncHandler(async (req, res) => {
  const result = await vendorService.listDocuments(req.params.id);
  return success(res, 200, "Vendor documents retrieved", result);
});

const addDocument = asyncHandler(async (req, res) => {
  const document = await vendorService.addDocument(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Vendor document registered", { document });
});

const uploadDocument = asyncHandler(async (req, res) => {
  const { moveToEntityFolder } = require("../utils/upload");
  const meta = moveToEntityFolder(req.file, [
    "vendors",
    String(req.params.id),
    "documents",
  ]);
  const document = await vendorService.addDocument(
    req.params.id,
    {
      documentName: req.body.documentName || meta.fileName,
      documentType: req.body.documentType || null,
      filePath: meta.filePath,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      expiryDate: req.body.expiryDate || null,
    },
    req.auth.adminId
  );
  return success(res, 201, "Vendor document uploaded", { document });
});

const removeDocument = asyncHandler(async (req, res) => {
  const document = await vendorService.softDeleteDocument(
    req.params.id,
    req.params.documentId,
    req.auth.adminId
  );
  return success(res, 200, "Vendor document archived", { document });
});

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  listPayments,
  addPayment,
  listDocuments,
  addDocument,
  uploadDocument,
  removeDocument,
};
