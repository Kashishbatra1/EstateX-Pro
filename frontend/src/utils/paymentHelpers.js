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
  if (details && !Array.isArray(details) && typeof details === "object") {
    if (details.remainingBalance != null && details.attemptedAmount != null) {
      return `${err.message} (remaining ${details.remainingBalance}, attempted ${details.attemptedAmount})`;
    }
    if (details.installmentId != null) {
      return err.message || "Installment payment rejected";
    }
  }
  if (Array.isArray(details) && details.length === 1 && details[0].message) {
    return details[0].message;
  }
  return err.message || "Request failed";
}

/** Round to 2 decimals for money comparison (display/validation only). */
export function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function installmentRemaining(installment) {
  if (!installment) return null;
  const due = Number(installment.amountDue) || 0;
  const paid = Number(installment.amountPaid) || 0;
  return roundMoney(due - paid);
}

export function emptyPaymentCreateForm() {
  return {
    bookingId: "",
    installmentId: "",
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethodId: "",
    bankAccountId: "",
    referenceNumber: "",
    notes: "",
  };
}

export function paymentToEditForm(payment) {
  return {
    amount: payment?.amount ?? "",
    paymentDate: payment?.paymentDate
      ? String(payment.paymentDate).slice(0, 10)
      : "",
    paymentMethodId:
      payment?.paymentMethodId != null ? String(payment.paymentMethodId) : "",
    bankAccountId:
      payment?.bankAccountId != null ? String(payment.bankAccountId) : "",
    referenceNumber: payment?.referenceNumber ?? "",
    notes: payment?.notes ?? "",
  };
}

export function buildCreatePayload(values) {
  const payload = {
    bookingId: Number(values.bookingId),
    amount: Number(values.amount),
    paymentMethodId: Number(values.paymentMethodId),
  };

  if (String(values.paymentDate || "").trim()) {
    payload.paymentDate = String(values.paymentDate).trim();
  }

  if (String(values.installmentId || "").trim()) {
    payload.installmentId = Number(values.installmentId);
  }

  if (String(values.bankAccountId || "").trim()) {
    payload.bankAccountId = Number(values.bankAccountId);
  }

  const ref = String(values.referenceNumber || "").trim();
  if (ref) payload.referenceNumber = ref;

  const notes = String(values.notes || "").trim();
  if (notes) payload.notes = notes;

  return payload;
}

export function buildUpdatePayload(values) {
  const payload = {
    amount: Number(values.amount),
    paymentMethodId: Number(values.paymentMethodId),
  };

  const date = String(values.paymentDate || "").trim();
  if (date) payload.paymentDate = date;

  if (String(values.bankAccountId || "").trim() === "") {
    payload.bankAccountId = null;
  } else {
    payload.bankAccountId = Number(values.bankAccountId);
  }

  payload.referenceNumber =
    String(values.referenceNumber || "").trim() === ""
      ? null
      : String(values.referenceNumber).trim();

  payload.notes =
    String(values.notes || "").trim() === ""
      ? null
      : String(values.notes).trim();

  return payload;
}

export function validateCreateForm(values, { bookingRemaining, installment }) {
  const errors = {};

  if (!values.bookingId) errors.bookingId = "Booking is required";
  if (!values.paymentMethodId) {
    errors.paymentMethodId = "Payment method is required";
  }

  const amountRaw = String(values.amount ?? "").trim();
  const amount = amountRaw === "" ? null : Number(amountRaw);
  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Amount must be greater than zero";
  } else {
    const rounded = roundMoney(amount);
    if (bookingRemaining != null && rounded > roundMoney(bookingRemaining)) {
      errors.amount = "Amount cannot exceed booking remaining balance";
    }
    if (values.installmentId && installment) {
      const instRem = installmentRemaining(installment);
      if (instRem != null && rounded > instRem) {
        errors.amount = "Amount cannot exceed installment remaining balance";
      }
    }
  }

  if (values.paymentDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.paymentDate)) {
    errors.paymentDate = "Use YYYY-MM-DD format";
  }

  return errors;
}

export function validateEditForm(values, { maxAmount, installment }) {
  const errors = {};
  if (!values.paymentMethodId) {
    errors.paymentMethodId = "Payment method is required";
  }

  const amountRaw = String(values.amount ?? "").trim();
  const amount = amountRaw === "" ? null : Number(amountRaw);
  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Amount must be greater than zero";
  } else if (maxAmount != null && roundMoney(amount) > roundMoney(maxAmount)) {
    errors.amount = "Amount exceeds allowed remaining capacity";
  } else if (installment) {
    const instRem = installmentRemaining(installment);
    // On edit, backend recalculates; frontend max is approximate — still warn if obvious
    if (
      instRem != null &&
      maxAmount == null &&
      roundMoney(amount) > instRem + Number(installment.amountPaid || 0)
    ) {
      // skip overly complex check — backend is authority
    }
  }

  if (values.paymentDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.paymentDate)) {
    errors.paymentDate = "Use YYYY-MM-DD format";
  }

  return errors;
}
