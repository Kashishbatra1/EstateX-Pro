/**
 * Validation for Booking Management endpoints.
 */
const ApiError = require("../utils/ApiError");
const { BOOKING_STATUSES } = require("../utils/bookingMapper");

function pushError(errors, field, message) {
  errors.push({ field, message });
}

function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validateMoneyPair(body, errors) {
  const amount = Number(body.bookingAmount);
  const total = Number(body.totalPrice);

  if (body.bookingAmount === undefined || body.bookingAmount === null || body.bookingAmount === "") {
    pushError(errors, "bookingAmount", "Booking amount / down payment is required");
  } else if (Number.isNaN(amount) || amount < 0) {
    pushError(errors, "bookingAmount", "Down payment must be a non-negative number");
  }

  if (body.totalPrice === undefined || body.totalPrice === null || body.totalPrice === "") {
    pushError(errors, "totalPrice", "Total price is required");
  } else if (Number.isNaN(total) || total < 0) {
    pushError(errors, "totalPrice", "Total price must be a non-negative number");
  }

  if (
    !Number.isNaN(amount) &&
    !Number.isNaN(total) &&
    amount >= 0 &&
    total >= 0 &&
    amount > total
  ) {
    pushError(errors, "bookingAmount", "Down payment cannot exceed total price");
  }
}

function validateCreateBooking(req, res, next) {
  const body = req.body || {};
  const errors = [];

  const propertyId = Number(body.propertyId);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    pushError(errors, "propertyId", "Valid property id is required");
  }

  const clientId = Number(body.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    pushError(errors, "clientId", "Valid client id is required");
  }

  validateMoneyPair(body, errors);

  if (
    body.monthlyInstallmentAmount !== undefined &&
    body.monthlyInstallmentAmount !== null &&
    body.monthlyInstallmentAmount !== ""
  ) {
    const monthly = Number(body.monthlyInstallmentAmount);
    if (Number.isNaN(monthly) || monthly < 0) {
      pushError(errors, "monthlyInstallmentAmount", "Monthly installment must be non-negative");
    }
  }

  if (body.installments !== undefined) {
    if (!Array.isArray(body.installments)) {
      pushError(errors, "installments", "Installments must be an array");
    } else {
      body.installments.forEach((item, index) => {
        if (!item || !isPresent(item.dueDate)) {
          pushError(errors, `installments[${index}].dueDate`, "Due date is required");
        }
        const due = Number(item.amountDue);
        if (item.amountDue === undefined || Number.isNaN(due) || due < 0) {
          pushError(
            errors,
            `installments[${index}].amountDue`,
            "Amount due must be a non-negative number"
          );
        }
      });
    }
  }

  if (body.status !== undefined && body.status !== null && body.status !== "") {
    pushError(errors, "status", "New bookings start as pending; use the status endpoint");
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.propertyId = propertyId;
  req.body.clientId = clientId;
  req.body.bookingAmount = Number(body.bookingAmount);
  req.body.totalPrice = Number(body.totalPrice);
  if (body.monthlyInstallmentAmount !== undefined && body.monthlyInstallmentAmount !== null && body.monthlyInstallmentAmount !== "") {
    req.body.monthlyInstallmentAmount = Number(body.monthlyInstallmentAmount);
  }
  return next();
}

function validateUpdateBooking(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (body.status !== undefined) {
    pushError(errors, "status", "Use PATCH /api/bookings/:id/status to change status");
  }
  if (body.propertyId !== undefined || body.clientId !== undefined) {
    pushError(errors, "propertyId/clientId", "Property and client cannot be changed after creation");
  }

  if (body.bookingAmount !== undefined || body.totalPrice !== undefined) {
    if (body.bookingAmount !== undefined) {
      const amount = Number(body.bookingAmount);
      if (Number.isNaN(amount) || amount < 0) {
        pushError(errors, "bookingAmount", "Down payment must be a non-negative number");
      }
    }
    if (body.totalPrice !== undefined) {
      const total = Number(body.totalPrice);
      if (Number.isNaN(total) || total < 0) {
        pushError(errors, "totalPrice", "Total price must be a non-negative number");
      }
    }
  }

  if (
    body.refundAmount !== undefined &&
    body.refundAmount !== null &&
    body.refundAmount !== ""
  ) {
    const refund = Number(body.refundAmount);
    if (Number.isNaN(refund) || refund < 0) {
      pushError(errors, "refundAmount", "Refund amount must be a non-negative number");
    }
  }

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  if (body.bookingAmount !== undefined) req.body.bookingAmount = Number(body.bookingAmount);
  if (body.totalPrice !== undefined) req.body.totalPrice = Number(body.totalPrice);
  if (body.refundAmount !== undefined && body.refundAmount !== null && body.refundAmount !== "") {
    req.body.refundAmount = Number(body.refundAmount);
  }
  return next();
}

function validateRefundFields(body, errors) {
  if (
    body.refundAmount !== undefined &&
    body.refundAmount !== null &&
    body.refundAmount !== ""
  ) {
    const refund = Number(body.refundAmount);
    if (Number.isNaN(refund) || refund < 0) {
      pushError(errors, "refundAmount", "Refund amount must be a non-negative number");
    } else {
      body.refundAmount = refund;
    }
  }
}

function validateStatusChange(req, res, next) {
  const body = req.body || {};
  const errors = [];
  const status = body.status;

  if (!isPresent(status)) {
    pushError(errors, "status", "Status is required");
  } else if (!BOOKING_STATUSES.includes(String(status).toLowerCase())) {
    pushError(errors, "status", `Status must be one of: ${BOOKING_STATUSES.join(", ")}`);
  }

  if (String(status || "").toLowerCase() === "cancelled" && !isPresent(body.cancellationReason)) {
    pushError(errors, "cancellationReason", "Cancellation reason is required when cancelling");
  }

  validateRefundFields(body, errors);

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.status = String(status).toLowerCase();
  return next();
}

function validateCancelBooking(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (!isPresent(body.cancellationReason)) {
    pushError(errors, "cancellationReason", "Cancellation reason is required when cancelling");
  }

  validateRefundFields(body, errors);

  if (errors.length) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  req.body.status = "cancelled";
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
  validateCreateBooking,
  validateUpdateBooking,
  validateStatusChange,
  validateCancelBooking,
  validateIdParam,
};
