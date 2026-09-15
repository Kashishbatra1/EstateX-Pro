export const COMMISSION_PAYMENT_STATUSES = ["unpaid", "partial", "paid"];

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
  if (Array.isArray(err.details) && err.details.length === 1 && err.details[0].message) {
    return err.details[0].message;
  }
  return err.message || "Request failed";
}

export function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Preview only — backend remains authoritative. */
export function previewCalculatedCommission(baseAmount, percentage) {
  if (baseAmount == null || percentage === "" || percentage == null) return null;
  const base = Number(baseAmount);
  const pct = Number(percentage);
  if (!Number.isFinite(base) || !Number.isFinite(pct)) return null;
  return roundMoney((base * pct) / 100);
}

export function resolveBaseFromSources(property, booking) {
  if (booking?.totalPrice != null) return roundMoney(booking.totalPrice);
  if (!property) return null;
  if (property.purpose === "rent") {
    return property.monthlyRent != null ? roundMoney(property.monthlyRent) : null;
  }
  return property.askingPrice != null ? roundMoney(property.askingPrice) : null;
}

export function emptyCommissionCreateForm() {
  return {
    propertyId: "",
    bookingId: "",
    commissionPercentage: "",
    brokerageFromBuyer: "0",
    brokerageFromSeller: "0",
    isManualOverride: false,
    finalAmount: "",
    overrideReason: "",
    paymentStatus: "unpaid",
    assignedAgentId: "",
    referralSource: "",
  };
}

export function commissionToEditForm(commission) {
  return {
    commissionPercentage:
      commission?.commissionPercentage != null
        ? String(commission.commissionPercentage)
        : "",
    brokerageFromBuyer:
      commission?.brokerageFromBuyer != null
        ? String(commission.brokerageFromBuyer)
        : "0",
    brokerageFromSeller:
      commission?.brokerageFromSeller != null
        ? String(commission.brokerageFromSeller)
        : "0",
    isManualOverride: Boolean(commission?.isManualOverride),
    finalAmount:
      commission?.finalAmount != null ? String(commission.finalAmount) : "",
    overrideReason: commission?.overrideReason || "",
    paymentStatus: commission?.paymentStatus || "unpaid",
    assignedAgentId:
      commission?.assignedAgentId != null
        ? String(commission.assignedAgentId)
        : "",
    referralSource: commission?.referralSource || "",
  };
}

function parseOptionalNonNegative(raw, field, errors) {
  const text = String(raw ?? "").trim();
  if (text === "") return 0;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) {
    errors[field] = `${field} must be a non-negative number`;
    return null;
  }
  return n;
}

export function validateCreateForm(values) {
  const errors = {};

  if (!values.propertyId) errors.propertyId = "Property is required";

  const pctRaw = String(values.commissionPercentage ?? "").trim();
  if (pctRaw !== "") {
    const pct = Number(pctRaw);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      errors.commissionPercentage = "Percentage must be between 0 and 100";
    }
  }

  parseOptionalNonNegative(values.brokerageFromBuyer, "brokerageFromBuyer", errors);
  parseOptionalNonNegative(
    values.brokerageFromSeller,
    "brokerageFromSeller",
    errors
  );

  if (values.isManualOverride) {
    const finalRaw = String(values.finalAmount ?? "").trim();
    const final = finalRaw === "" ? null : Number(finalRaw);
    if (final === null || !Number.isFinite(final) || final < 0) {
      errors.finalAmount = "Final amount is required for manual override";
    }
    if (!String(values.overrideReason || "").trim()) {
      errors.overrideReason = "Override reason is required";
    }
  }

  if (
    values.paymentStatus &&
    !COMMISSION_PAYMENT_STATUSES.includes(values.paymentStatus)
  ) {
    errors.paymentStatus = "Invalid payment status";
  }

  const agentRaw = String(values.assignedAgentId ?? "").trim();
  if (agentRaw !== "") {
    const agent = Number(agentRaw);
    if (!Number.isInteger(agent) || agent <= 0) {
      errors.assignedAgentId = "Enter a valid employees.id";
    }
  }

  return errors;
}

export function validateEditForm(values) {
  return validateCreateForm({ ...values, propertyId: "1" });
}

export function buildCreatePayload(values) {
  const payload = {
    propertyId: Number(values.propertyId),
    paymentStatus: values.paymentStatus || "unpaid",
    isManualOverride: Boolean(values.isManualOverride),
  };

  if (String(values.bookingId || "").trim()) {
    payload.bookingId = Number(values.bookingId);
  }

  const pctRaw = String(values.commissionPercentage ?? "").trim();
  if (pctRaw !== "") {
    payload.commissionPercentage = Number(pctRaw);
  }

  payload.brokerageFromBuyer = Number(values.brokerageFromBuyer || 0);
  payload.brokerageFromSeller = Number(values.brokerageFromSeller || 0);

  if (payload.isManualOverride) {
    payload.finalAmount = Number(values.finalAmount);
    payload.overrideReason = String(values.overrideReason).trim();
  }

  if (String(values.assignedAgentId || "").trim()) {
    payload.assignedAgentId = Number(values.assignedAgentId);
  }

  const referral = String(values.referralSource || "").trim();
  if (referral) payload.referralSource = referral;

  return payload;
}

export function buildUpdatePayload(values) {
  const payload = {
    paymentStatus: values.paymentStatus || "unpaid",
    isManualOverride: Boolean(values.isManualOverride),
    brokerageFromBuyer: Number(values.brokerageFromBuyer || 0),
    brokerageFromSeller: Number(values.brokerageFromSeller || 0),
  };

  const pctRaw = String(values.commissionPercentage ?? "").trim();
  payload.commissionPercentage = pctRaw === "" ? null : Number(pctRaw);

  if (payload.isManualOverride) {
    payload.finalAmount = Number(values.finalAmount);
    payload.overrideReason = String(values.overrideReason).trim();
  } else {
    payload.overrideReason = null;
  }

  if (String(values.assignedAgentId || "").trim() === "") {
    payload.assignedAgentId = null;
  } else {
    payload.assignedAgentId = Number(values.assignedAgentId);
  }

  payload.referralSource =
    String(values.referralSource || "").trim() === ""
      ? null
      : String(values.referralSource).trim();

  return payload;
}
