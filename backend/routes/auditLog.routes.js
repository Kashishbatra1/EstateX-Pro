const express = require("express");
const auditLogController = require("../controllers/auditLog.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", auditLogController.list);
router.get("/:id", auditLogController.getById);

module.exports = router;
