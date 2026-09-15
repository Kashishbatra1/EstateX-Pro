/**
 * Validation for Notifications endpoints.
 */
const ApiError = require("../utils/ApiError");
const { NOTIFICATION_TYPES } = require("../utils/notificationMapper");

function pushError(errors, field, message) {
  errors.push({ field, message });
}

function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validateCreateNotification(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (!isPresent(body.title)) {
    pushError(errors, "title", "Title is required");
  } else if (String(body.title).trim().length > 200) {
    pushError(errors, "title", "Title must be at most 200 characters");
  }

  if (!isPresent(body.message)) {
    pushError(errors, "message", "Message is required");
  }

  if (body.notificationType !== undefined && body.notificationType !== null && body.notificationType !== "") {
    if (!NOTIFICATION_TYPES.includes(String(body.notificationType).toLowerCase())) {
      pushError(
        errors,
        "notificationType",
        `Must be one of: ${NOTIFICATION_TYPES.join(", ")}`
      );
    }
  }

  if (body.adminId !== undefined && body.adminId !== null && body.adminId !== "") {
    const id = Number(body.adminId);
    if (!Number.isInteger(id) || id <= 0) {
      pushError(errors, "adminId", "Valid admin id is required");
    }
  }

  if (body.entityId !== undefined && body.entityId !== null && body.entityId !== "") {
    const id = Number(body.entityId);
    if (!Number.isInteger(id) || id <= 0) {
      pushError(errors, "entityId", "Valid entity id is required");
    }
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  if (body.notificationType) {
    req.body.notificationType = String(body.notificationType).toLowerCase();
  } else {
    req.body.notificationType = "general";
  }
  req.body.title = String(body.title).trim();
  req.body.message = String(body.message).trim();
  if (body.adminId !== undefined && body.adminId !== null && body.adminId !== "") {
    req.body.adminId = Number(body.adminId);
  }
  if (body.entityId !== undefined && body.entityId !== null && body.entityId !== "") {
    req.body.entityId = Number(body.entityId);
  }
  return next();
}

function validateIdParam(paramName = "id") {
  return (req, res, next) => {
    const id = Number(req.params[paramName]);
    if (!Number.isInteger(id) || id <= 0) {
      return next(new ApiError(400, `Invalid ${paramName}`));
    }
    req.params[paramName] = id;
    return next();
  };
}

module.exports = {
  validateCreateNotification,
  validateIdParam,
};
