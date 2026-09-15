/**
 * Nested property ↔ bank account routes.
 * Mounted at /api/properties/:propertyId/bank-accounts
 */
const express = require("express");
const bankController = require("../controllers/bank.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateLinkBankAccount,
  validateIdParam,
} = require("../middleware/validateBank");

const router = express.Router({ mergeParams: true });

router.use(authenticate, requireAdmin);
router.use(validateIdParam("propertyId"));

router.get("/", bankController.listForProperty);
router.post("/", validateLinkBankAccount, bankController.linkToProperty);
router.patch(
  "/:bankAccountId",
  validateIdParam("bankAccountId"),
  bankController.updatePropertyLink
);
router.delete(
  "/:bankAccountId",
  validateIdParam("bankAccountId"),
  bankController.unlinkFromProperty
);

module.exports = router;
