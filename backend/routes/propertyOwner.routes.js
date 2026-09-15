/**
 * Nested property ↔ owner relationship routes.
 * Mounted at /api/properties/:propertyId/owners
 */
const express = require("express");
const ownerController = require("../controllers/owner.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateLinkOwner,
  validateShareUpdate,
  validateIdParam,
} = require("../middleware/validateOwner");

const router = express.Router({ mergeParams: true });

router.use(authenticate, requireAdmin);
router.use(validateIdParam("propertyId"));

router.get("/", ownerController.listForProperty);
router.post("/", validateLinkOwner, ownerController.linkToProperty);
router.patch(
  "/:ownerId",
  validateIdParam("ownerId"),
  validateShareUpdate,
  ownerController.updateShare
);
router.delete(
  "/:ownerId",
  validateIdParam("ownerId"),
  ownerController.unlinkFromProperty
);

module.exports = router;
