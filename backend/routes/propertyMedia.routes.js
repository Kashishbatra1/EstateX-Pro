/**
 * Nested property ↔ media routes.
 * Mounted at /api/properties/:propertyId/media
 */
const express = require("express");
const propertyDocumentController = require("../controllers/propertyDocument.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateIdParam,
  validateCreateMedia,
  validateUpdateMedia,
} = require("../middleware/validatePropertyDocument");
const {
  mediaUpload,
  singleFile,
  requireUploadedFile,
} = require("../utils/upload");

const router = express.Router({ mergeParams: true });

router.use(authenticate, requireAdmin);
router.use(validateIdParam("propertyId"));

router.get("/", propertyDocumentController.listMedia);
router.post("/", validateCreateMedia, propertyDocumentController.createMedia);
router.post(
  "/upload",
  singleFile(mediaUpload),
  requireUploadedFile,
  propertyDocumentController.uploadMedia
);
router.get(
  "/:mediaId",
  validateIdParam("mediaId"),
  propertyDocumentController.getMedia
);
router.put(
  "/:mediaId",
  validateIdParam("mediaId"),
  validateUpdateMedia,
  propertyDocumentController.updateMedia
);
router.delete(
  "/:mediaId",
  validateIdParam("mediaId"),
  propertyDocumentController.removeMedia
);

module.exports = router;
