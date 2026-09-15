const express = require("express");
const notificationController = require("../controllers/notification.controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const {
  validateCreateNotification,
  validateIdParam,
} = require("../middleware/validateNotification");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", notificationController.list);
router.post("/", validateCreateNotification, notificationController.create);
router.post("/reminders/process", notificationController.processReminders);
router.patch("/read-all", notificationController.markAllRead);

router.get("/:id", validateIdParam("id"), notificationController.getById);
router.patch("/:id/read", validateIdParam("id"), notificationController.markRead);
router.patch("/:id/unread", validateIdParam("id"), notificationController.markUnread);
router.delete("/:id", validateIdParam("id"), notificationController.remove);

module.exports = router;
