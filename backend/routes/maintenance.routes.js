const express = require("express");
const maintenanceController = require("../controllers/maintenance.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateIdParam,
  validateCreateMaintenance,
  validateUpdateMaintenance,
} = require("../middleware/validateMaintenance");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", maintenanceController.list);
router.post("/", validateCreateMaintenance, maintenanceController.create);
router.post("/reminders/process", maintenanceController.processReminders);

router.get("/:id", validateIdParam("id"), maintenanceController.getById);
router.put(
  "/:id",
  validateIdParam("id"),
  validateUpdateMaintenance,
  maintenanceController.update
);
router.delete("/:id", validateIdParam("id"), maintenanceController.remove);

module.exports = router;
