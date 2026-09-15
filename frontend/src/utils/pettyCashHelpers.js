export function emptyPettyForm() {
  return {
    accountName: "",
    custodianEmployeeId: "",
    floatAmount: "0",
    isActive: true,
    notes: "",
  };
}

export function accountToForm(account) {
  return {
    accountName: account?.accountName || "",
    custodianEmployeeId:
      account?.custodianEmployeeId != null ? String(account.custodianEmployeeId) : "",
    floatAmount: account?.floatAmount != null ? String(account.floatAmount) : "0",
    isActive: account?.isActive !== false,
    notes: account?.notes || "",
  };
}

export function buildPettyPayload(values, { includeActive = false } = {}) {
  const payload = {
    accountName: values.accountName.trim(),
    custodianEmployeeId: Number(values.custodianEmployeeId),
    floatAmount: Number(values.floatAmount || 0),
    notes: values.notes?.trim() || null,
  };
  if (includeActive) payload.isActive = Boolean(values.isActive);
  return payload;
}

export function formatApiError(err) {
  if (!err) return "Request failed";
  if (Array.isArray(err.errors) && err.errors.length) {
    return err.errors.map((e) => e.message || e.field).join("; ");
  }
  return err.message || "Request failed";
}
