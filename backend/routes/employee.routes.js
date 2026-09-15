git status/**
 * Minimal employees list for assignment / expense paid-by selection.
 * Mounted at /api/employees
 */
const express = require("express");
const inventoryController = require("../controllers/inventory.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requireAdmin);
router.get("/", inventoryController.listEmployees);

module.exports = router;
