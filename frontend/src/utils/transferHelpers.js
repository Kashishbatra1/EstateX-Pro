export const TRANSFER_TYPES = ["resale", "transfer"];

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

export function emptyTransferCreateForm() {
  return {
    propertyId: "",
    transferType: "resale",
    fromOwnerId: "",
    toOwnerId: "",
    fromClientId: "",
    toClientId: "",
    transferDate: new Date().toISOString().slice(0, 10),
    transferCharges: "0",
    leaseCharges: "0",
    transferTax: "0",
    stampDuty: "0",
    nocForTransfer: false,
    nocStatus: "",
    nocDocumentPath: "",
    notes: "",
  };
}

export function transferToEditForm(transfer) {
  return {
    transferType: transfer?.transferType || "resale",
    fromOwnerId:
      transfer?.fromOwnerId != null ? String(transfer.fromOwnerId) : "",
    toOwnerId: transfer?.toOwnerId != null ? String(transfer.toOwnerId) : "",
    fromClientId:
      transfer?.fromClientId != null ? String(transfer.fromClientId) : "",
    toClientId: transfer?.toClientId != null ? String(transfer.toClientId) : "",
    transferDate: transfer?.transferDate
      ? String(transfer.transferDate).slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    transferCharges:
      transfer?.transferCharges != null ? String(transfer.transferCharges) : "0",
    leaseCharges:
      transfer?.leaseCharges != null ? String(transfer.leaseCharges) : "0",
    transferTax:
      transfer?.transferTax != null ? String(transfer.transferTax) : "0",
    stampDuty: transfer?.stampDuty != null ? String(transfer.stampDuty) : "0",
    nocForTransfer: Boolean(transfer?.nocForTransfer),
    nocStatus: transfer?.nocStatus || "",
    nocDocumentPath: transfer?.nocDocumentPath || "",
    notes: transfer?.notes || "",
  };
}

function parseOptionalId(raw, field, errors) {
  const text = String(raw ?? "").trim();
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isInteger(n) || n <= 0) {
    errors[field] = `Valid ${field} is required`;
    return null;
  }
  return n;
}

function parseNonNegative(raw, field, errors) {
  const text = String(raw ?? "").trim();
  if (text === "") return 0;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) {
    errors[field] = `${field} must be a non-negative number`;
    return null;
  }
  return n;
}

export function validateTransferForm(values, { requireProperty = true } = {}) {
  const errors = {};

  if (requireProperty && !values.propertyId) {
    errors.propertyId = "Property is required";
  }

  if (!TRANSFER_TYPES.includes(values.transferType)) {
    errors.transferType = "Transfer type must be resale or transfer";
  }

  parseOptionalId(values.fromOwnerId, "fromOwnerId", errors);
  parseOptionalId(values.toOwnerId, "toOwnerId", errors);
  parseOptionalId(values.fromClientId, "fromClientId", errors);
  parseOptionalId(values.toClientId, "toClientId", errors);

  parseNonNegative(values.transferCharges, "transferCharges", errors);
  parseNonNegative(values.leaseCharges, "leaseCharges", errors);
  parseNonNegative(values.transferTax, "transferTax", errors);
  parseNonNegative(values.stampDuty, "stampDuty", errors);

  if (
    values.transferDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(String(values.transferDate).trim())
  ) {
    errors.transferDate = "Use YYYY-MM-DD format";
  }

  return errors;
}

export function buildCreatePayload(values) {
  const payload = {
    propertyId: Number(values.propertyId),
    transferType: values.transferType,
    transferCharges: Number(values.transferCharges || 0),
    leaseCharges: Number(values.leaseCharges || 0),
    transferTax: Number(values.transferTax || 0),
    stampDuty: Number(values.stampDuty || 0),
    nocForTransfer: Boolean(values.nocForTransfer),
  };

  if (String(values.transferDate || "").trim()) {
    payload.transferDate = String(values.transferDate).trim();
  }

  if (String(values.fromOwnerId || "").trim()) {
    payload.fromOwnerId = Number(values.fromOwnerId);
  }
  if (String(values.toOwnerId || "").trim()) {
    payload.toOwnerId = Number(values.toOwnerId);
  }
  if (String(values.fromClientId || "").trim()) {
    payload.fromClientId = Number(values.fromClientId);
  }
  if (String(values.toClientId || "").trim()) {
    payload.toClientId = Number(values.toClientId);
  }

  const nocStatus = String(values.nocStatus || "").trim();
  if (nocStatus) payload.nocStatus = nocStatus;

  const nocPath = String(values.nocDocumentPath || "").trim();
  if (nocPath) payload.nocDocumentPath = nocPath;

  const notes = String(values.notes || "").trim();
  if (notes) payload.notes = notes;

  return payload;
}

export function buildUpdatePayload(values) {
  const payload = {
    transferType: values.transferType,
    transferCharges: Number(values.transferCharges || 0),
    leaseCharges: Number(values.leaseCharges || 0),
    transferTax: Number(values.transferTax || 0),
    stampDuty: Number(values.stampDuty || 0),
    nocForTransfer: Boolean(values.nocForTransfer),
    transferDate: String(values.transferDate || "").trim(),
    fromOwnerId: String(values.fromOwnerId || "").trim()
      ? Number(values.fromOwnerId)
      : null,
    toOwnerId: String(values.toOwnerId || "").trim()
      ? Number(values.toOwnerId)
      : null,
    fromClientId: String(values.fromClientId || "").trim()
      ? Number(values.fromClientId)
      : null,
    toClientId: String(values.toClientId || "").trim()
      ? Number(values.toClientId)
      : null,
    nocStatus: String(values.nocStatus || "").trim() || null,
    nocDocumentPath: String(values.nocDocumentPath || "").trim() || null,
    notes: String(values.notes || "").trim() || null,
  };
  return payload;
}

export function totalCharges(transfer) {
  return (
    Number(transfer?.transferCharges || 0) +
    Number(transfer?.leaseCharges || 0) +
    Number(transfer?.transferTax || 0) +
    Number(transfer?.stampDuty || 0)
  );
}
