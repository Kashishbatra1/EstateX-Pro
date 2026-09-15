const notificationService = require("../services/notification.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const create = asyncHandler(async (req, res) => {
  const notification = await notificationService.createNotification(
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Notification created", { notification });
});

const list = asyncHandler(async (req, res) => {
  const result = await notificationService.listNotifications(
    req.query,
    req.auth.adminId
  );
  return success(res, 200, "Notifications retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const notification = await notificationService.getNotificationById(
    req.params.id,
    req.auth.adminId
  );
  return success(res, 200, "Notification retrieved", { notification });
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(
    req.params.id,
    req.auth.adminId,
    true
  );
  return success(res, 200, "Notification marked as read", { notification });
});

const markUnread = asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(
    req.params.id,
    req.auth.adminId,
    false
  );
  return success(res, 200, "Notification marked as unread", { notification });
});

const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllRead(req.auth.adminId);
  return success(res, 200, "All notifications marked as read", result);
});

const remove = asyncHandler(async (req, res) => {
  const result = await notificationService.deleteNotification(
    req.params.id,
    req.auth.adminId
  );
  return success(res, 200, "Notification deleted", result);
});

const processReminders = asyncHandler(async (req, res) => {
  const daysAhead = req.query.daysAhead || req.body?.daysAhead;
  const result = await notificationService.processReminders({ daysAhead });
  return success(res, 200, "Reminders processed", result);
});

module.exports = {
  create,
  list,
  getById,
  markRead,
  markUnread,
  markAllRead,
  remove,
  processReminders,
};
