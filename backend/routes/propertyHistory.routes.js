/**
 * Nested property ↔ history routes.
 * Mounted at /api/properties/:propertyId/history
 */
const express = require("express");
const propertyHistoryController = require("../controllers/propertyHistory.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validatePropertyIdParam,
  validateHistoryQuery,
} = require("../middleware/validatePropertyHistory");

const router = express.Router({ mergeParams: true });

router.use(authenticate, requireAdmin);
router.use(validatePropertyIdParam);

router.get("/", validateHistoryQuery, propertyHistoryController.listForProperty);

module.exports = router;
