/**
 * Nested property ↔ documents routes.
 * Mounted at /api/properties/:propertyId/documents
 */
const express = require("express");
const propertyDocumentController = require("../controllers/propertyDocument.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateIdParam,
  validateCreateDocument,
  validateUpdateDocument,
} = require("../middleware/validatePropertyDocument");
const {
  documentUpload,
  mediaUpload,
  singleFile,
  requireUploadedFile,
} = require("../utils/upload");

const router = express.Router({ mergeParams: true });

router.use(authenticate, requireAdmin);
router.use(validateIdParam("propertyId"));

router.get("/", propertyDocumentController.listDocuments);
router.post("/", validateCreateDocument, propertyDocumentController.createDocument);
router.post(
  "/upload",
  singleFile(documentUpload),
  requireUploadedFile,
  propertyDocumentController.uploadDocument
);
router.get(
  "/:documentId",
  validateIdParam("documentId"),
  propertyDocumentController.getDocument
);
router.put(
  "/:documentId",
  validateIdParam("documentId"),
  validateUpdateDocument,
  propertyDocumentController.updateDocument
);
router.delete(
  "/:documentId",
  validateIdParam("documentId"),
  propertyDocumentController.removeDocument
);

module.exports = router;
