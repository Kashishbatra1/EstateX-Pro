const propertyDocumentService = require("../services/propertyDocument.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const listDocuments = asyncHandler(async (req, res) => {
  const result = await propertyDocumentService.listDocuments(
    req.params.propertyId,
    req.query
  );
  return success(res, 200, "Property documents retrieved", result);
});

const getDocument = asyncHandler(async (req, res) => {
  const document = await propertyDocumentService.getDocument(
    req.params.propertyId,
    req.params.documentId
  );
  return success(res, 200, "Property document retrieved", { document });
});

const createDocument = asyncHandler(async (req, res) => {
  const document = await propertyDocumentService.createDocument(
    req.params.propertyId,
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Property document registered", { document });
});

const updateDocument = asyncHandler(async (req, res) => {
  const document = await propertyDocumentService.updateDocument(
    req.params.propertyId,
    req.params.documentId,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Property document updated", { document });
});

const removeDocument = asyncHandler(async (req, res) => {
  const document = await propertyDocumentService.softDeleteDocument(
    req.params.propertyId,
    req.params.documentId,
    req.auth.adminId
  );
  return success(res, 200, "Property document moved to recycle bin", {
    document,
  });
});

const listMedia = asyncHandler(async (req, res) => {
  const result = await propertyDocumentService.listMedia(
    req.params.propertyId,
    req.query
  );
  return success(res, 200, "Property media retrieved", result);
});

const getMedia = asyncHandler(async (req, res) => {
  const media = await propertyDocumentService.getMedia(
    req.params.propertyId,
    req.params.mediaId
  );
  return success(res, 200, "Property media retrieved", { media });
});

const createMedia = asyncHandler(async (req, res) => {
  const media = await propertyDocumentService.createMedia(
    req.params.propertyId,
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Property media registered", { media });
});

const uploadDocument = asyncHandler(async (req, res) => {
  const { moveToEntityFolder } = require("../utils/upload");
  const meta = moveToEntityFolder(req.file, [
    "properties",
    String(req.params.propertyId),
    "documents",
  ]);
  const document = await propertyDocumentService.createDocument(
    req.params.propertyId,
    {
      documentType: req.body.documentType || "other",
      documentName: req.body.documentName || meta.fileName,
      filePath: meta.filePath,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      expiryDate: req.body.expiryDate || null,
      notes: req.body.notes || null,
    },
    req.auth.adminId
  );
  return success(res, 201, "Property document uploaded", { document });
});

const uploadMedia = asyncHandler(async (req, res) => {
  const ApiError = require("../utils/ApiError");
  const { moveToEntityFolder } = require("../utils/upload");
  const mediaType = String(req.body.mediaType || "image").toLowerCase();
  if (mediaType === "video") {
    throw new ApiError(400, "Video binary upload is not supported", [
      {
        field: "mediaType",
        message: "Upload images or floor plans, or register a video URL via the path form",
      },
    ]);
  }
  if (!["image", "floor_plan"].includes(mediaType)) {
    throw new ApiError(400, "Invalid media type", [
      { field: "mediaType", message: "Must be image or floor_plan for uploads" },
    ]);
  }
  const meta = moveToEntityFolder(req.file, [
    "properties",
    String(req.params.propertyId),
    "media",
  ]);
  const media = await propertyDocumentService.createMedia(
    req.params.propertyId,
    {
      mediaType,
      filePath: meta.filePath,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      caption: req.body.caption || null,
      sortOrder: req.body.sortOrder != null ? Number(req.body.sortOrder) : 0,
      isCover:
        req.body.isCover === true ||
        req.body.isCover === "true" ||
        req.body.isCover === "1",
    },
    req.auth.adminId
  );
  return success(res, 201, "Property media uploaded", { media });
});

const updateMedia = asyncHandler(async (req, res) => {
  const media = await propertyDocumentService.updateMedia(
    req.params.propertyId,
    req.params.mediaId,
    req.body,
    req.auth.adminId
  );
  return success(res, 200, "Property media updated", { media });
});

const removeMedia = asyncHandler(async (req, res) => {
  const media = await propertyDocumentService.softDeleteMedia(
    req.params.propertyId,
    req.params.mediaId,
    req.auth.adminId
  );
  return success(res, 200, "Property media moved to recycle bin", { media });
});

module.exports = {
  listDocuments,
  getDocument,
  createDocument,
  uploadDocument,
  updateDocument,
  removeDocument,
  listMedia,
  getMedia,
  createMedia,
  uploadMedia,
  updateMedia,
  removeMedia,
};
