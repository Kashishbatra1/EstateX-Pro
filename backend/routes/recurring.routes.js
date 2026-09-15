const express = require("express");
const recurringController = require("../controllers/recurring.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateIdParam,
  validateCreateRecurring,
  validateUpdateRecurring,
} = require("../middleware/validateRecurring");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", recurringController.list);
router.post("/", validateCreateRecurring, recurringController.create);
router.post("/reminders/process", recurringController.processReminders);

router.get("/:id", validateIdParam("id"), recurringController.getById);
router.put(
  "/:id",
  validateIdParam("id"),
  validateUpdateRecurring,
  recurringController.update
);
router.delete("/:id", validateIdParam("id"), recurringController.remove);

module.exports = router;
