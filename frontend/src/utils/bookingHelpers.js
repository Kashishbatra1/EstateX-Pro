export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
];

export function formatLabel(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapApiFieldErrors(details) {
  const mapped = {};
  if (Array.isArray(details)) {
    for (const item of details) {
      if (item?.field) mapped[item.field] = item.message || "Invalid value";
    }
  }
  return mapped;
}

export function formatApiError(err) {
  if (!err) return "Request failed";
  const details = err.details;
  if (details?.allowedTransitions?.length) {
    return `${err.message} (allowed: ${details.allowedTransitions.join(", ")})`;
  }
  if (details?.conflictingBookingCode) {
    return `${err.message} (conflict: ${details.conflictingBookingCode})`;
  }
  if (Array.isArray(details) && details.length === 1 && details[0].message) {
    return details[0].message;
  }
  return err.message || "Request failed";
}

export function emptyBookingCreateForm() {
  return {
    propertyId: "",
    clientId: "",
    totalPrice: "",
    bookingAmount: "",
    installmentPlanName: "",
    monthlyInstallmentAmount: "",
    tokenReceiptNumber: "",
    bookingExpiryDate: "",
    digitalAgreementUrl: "",
  };
}

export function bookingToEditForm(booking) {
  return {
    totalPrice: booking?.totalPrice ?? "",
    bookingAmount: booking?.bookingAmount ?? "",
    installmentPlanName: booking?.installmentPlanName ?? "",
    monthlyInstallmentAmount: booking?.monthlyInstallmentAmount ?? "",
    tokenReceiptNumber: booking?.tokenReceiptNumber ?? "",
    bookingExpiryDate: booking?.bookingExpiryDate
      ? String(booking.bookingExpiryDate).slice(0, 10)
      : "",
    digitalAgreementUrl: booking?.digitalAgreementUrl ?? "",
  };
}

export function buildCreatePayload(values) {
  const totalPrice = Number(values.totalPrice);
  const bookingAmount = Number(values.bookingAmount);
  const payload = {
    propertyId: Number(values.propertyId),
    clientId: Number(values.clientId),
    totalPrice,
    bookingAmount,
  };

  const plan = String(values.installmentPlanName || "").trim();
  if (plan) payload.installmentPlanName = plan;

  if (String(values.monthlyInstallmentAmount || "").trim() !== "") {
    payload.monthlyInstallmentAmount = Number(values.monthlyInstallmentAmount);
  }

  const token = String(values.tokenReceiptNumber || "").trim();
  if (token) payload.tokenReceiptNumber = token;

  const expiry = String(values.bookingExpiryDate || "").trim();
  if (expiry) payload.bookingExpiryDate = expiry;

  const url = String(values.digitalAgreementUrl || "").trim();
  if (url) payload.digitalAgreementUrl = url;

  return payload;
}

export function buildUpdatePayload(values) {
  const payload = {
    totalPrice: Number(values.totalPrice),
    bookingAmount: Number(values.bookingAmount),
  };

  for (const key of [
    "installmentPlanName",
    "tokenReceiptNumber",
    "digitalAgreementUrl",
  ]) {
    const trimmed = String(values[key] ?? "").trim();
    payload[key] = trimmed === "" ? null : trimmed;
  }

  const expiry = String(values.bookingExpiryDate || "").trim();
  payload.bookingExpiryDate = expiry === "" ? null : expiry;

  if (String(values.monthlyInstallmentAmount || "").trim() === "") {
    payload.monthlyInstallmentAmount = null;
  } else {
    payload.monthlyInstallmentAmount = Number(values.monthlyInstallmentAmount);
  }

  return payload;
}

export function validateCreateForm(values) {
  const errors = {};
  if (!values.propertyId) errors.propertyId = "Property is required";
  if (!values.clientId) errors.clientId = "Client is required";

  const total =
    String(values.totalPrice).trim() === "" ? null : Number(values.totalPrice);
  const down =
    String(values.bookingAmount).trim() === ""
      ? null
      : Number(values.bookingAmount);

  if (total === null || Number.isNaN(total) || total < 0) {
    errors.totalPrice = "Total price is required and must be non-negative";
  }
  if (down === null || Number.isNaN(down) || down < 0) {
    errors.bookingAmount =
      "Down payment is required and must be non-negative";
  }
  if (
    total !== null &&
    down !== null &&
    !Number.isNaN(total) &&
    !Number.isNaN(down) &&
    down > total
  ) {
    errors.bookingAmount = "Down payment cannot exceed total price";
  }

  if (String(values.monthlyInstallmentAmount || "").trim() !== "") {
    const m = Number(values.monthlyInstallmentAmount);
    if (Number.isNaN(m) || m < 0) {
      errors.monthlyInstallmentAmount = "Must be a non-negative number";
    }
  }

  return errors;
}

export function validateEditForm(values) {
  const errors = {};
  const total =
    String(values.totalPrice).trim() === "" ? null : Number(values.totalPrice);
  const down =
    String(values.bookingAmount).trim() === ""
      ? null
      : Number(values.bookingAmount);

  if (total === null || Number.isNaN(total) || total < 0) {
    errors.totalPrice = "Total price is required and must be non-negative";
  }
  if (down === null || Number.isNaN(down) || down < 0) {
    errors.bookingAmount =
      "Down payment is required and must be non-negative";
  }
  if (
    total !== null &&
    down !== null &&
    !Number.isNaN(total) &&
    !Number.isNaN(down) &&
    down > total
  ) {
    errors.bookingAmount = "Down payment cannot exceed total price";
  }

  if (String(values.monthlyInstallmentAmount || "").trim() !== "") {
    const m = Number(values.monthlyInstallmentAmount);
    if (Number.isNaN(m) || m < 0) {
      errors.monthlyInstallmentAmount = "Must be a non-negative number";
    }
  }

  return errors;
}

export function remainingPreview(totalPrice, bookingAmount) {
  const total = Number(totalPrice);
  const down = Number(bookingAmount);
  if (Number.isNaN(total) || Number.isNaN(down)) return null;
  return total - down;
}

export function canEditBooking(status) {
  return status === "pending" || status === "confirmed";
}

export function canConfirmBooking(status) {
  return status === "pending";
}

export function canCompleteBooking(status) {
  return status === "confirmed";
}

export function canCancelBooking(status) {
  return status === "pending" || status === "confirmed";
}

export function canArchiveBooking(status) {
  return status !== "confirmed";
}
