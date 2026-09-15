const express = require("express");
const backupController = require("../controllers/backup.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get("/", backupController.list);
router.post("/", backupController.create);
router.post("/:id/restore", backupController.restore);

module.exports = router;
