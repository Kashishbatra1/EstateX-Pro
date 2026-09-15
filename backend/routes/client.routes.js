const express = require("express");
const clientController = require("../controllers/client.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateCreateClient,
  validateUpdateClient,
  validateCommunication,
  validateKycDocument,
  validateFollowUp,
  validateIdParam,
} = require("../middleware/validateClient");
const {
  documentUpload,
  singleFile,
  requireUploadedFile,
} = require("../utils/upload");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", clientController.list);
router.post("/", validateCreateClient, clientController.create);

router.get("/:id", validateIdParam("id"), clientController.getById);
router.put("/:id", validateIdParam("id"), validateUpdateClient, clientController.update);
router.patch(
  "/:id/notes",
  validateIdParam("id"),
  clientController.updateNotes
);
router.patch(
  "/:id/follow-up",
  validateIdParam("id"),
  validateFollowUp,
  clientController.updateFollowUp
);
router.delete("/:id", validateIdParam("id"), clientController.remove);

router.get(
  "/:id/communications",
  validateIdParam("id"),
  clientController.listCommunications
);
router.post(
  "/:id/communications",
  validateIdParam("id"),
  validateCommunication,
  clientController.addCommunication
);

router.get("/:id/kyc-documents", validateIdParam("id"), clientController.listKyc);
router.post(
  "/:id/kyc-documents",
  validateIdParam("id"),
  validateKycDocument,
  clientController.addKyc
);
router.post(
  "/:id/kyc-documents/upload",
  validateIdParam("id"),
  singleFile(documentUpload),
  requireUploadedFile,
  clientController.uploadKyc
);
router.delete(
  "/:id/kyc-documents/:documentId",
  validateIdParam("id"),
  validateIdParam("documentId"),
  clientController.removeKyc
);

module.exports = router;
