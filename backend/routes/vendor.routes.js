const express = require("express");
const vendorController = require("../controllers/vendor.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateIdParam,
  validateCreateVendor,
  validateUpdateVendor,
  validateVendorPayment,
  validateVendorDocument,
} = require("../middleware/validateVendor");
const {
  documentUpload,
  singleFile,
  requireUploadedFile,
} = require("../utils/upload");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", vendorController.list);
router.post("/", validateCreateVendor, vendorController.create);

router.get("/:id", validateIdParam("id"), vendorController.getById);
router.put(
  "/:id",
  validateIdParam("id"),
  validateUpdateVendor,
  vendorController.update
);
router.delete("/:id", validateIdParam("id"), vendorController.remove);

router.get(
  "/:id/payments",
  validateIdParam("id"),
  vendorController.listPayments
);
router.post(
  "/:id/payments",
  validateIdParam("id"),
  validateVendorPayment,
  vendorController.addPayment
);

router.get(
  "/:id/documents",
  validateIdParam("id"),
  vendorController.listDocuments
);
router.post(
  "/:id/documents",
  validateIdParam("id"),
  validateVendorDocument,
  vendorController.addDocument
);
router.post(
  "/:id/documents/upload",
  validateIdParam("id"),
  singleFile(documentUpload),
  requireUploadedFile,
  vendorController.uploadDocument
);
router.delete(
  "/:id/documents/:documentId",
  validateIdParam("id"),
  validateIdParam("documentId"),
  vendorController.removeDocument
);

module.exports = router;
