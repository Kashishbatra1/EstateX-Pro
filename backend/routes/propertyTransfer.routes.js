/**
 * Nested property ↔ transfers routes.
 * Mounted at /api/properties/:propertyId/transfers
 */
const express = require("express");
const transferController = require("../controllers/transfer.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { validateIdParam } = require("../middleware/validateTransfer");

const router = express.Router({ mergeParams: true });

router.use(authenticate, requireAdmin);
router.use(validateIdParam("propertyId"));

router.get("/", transferController.listForProperty);

module.exports = router;
