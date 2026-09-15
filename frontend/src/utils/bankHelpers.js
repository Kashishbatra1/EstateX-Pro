export function formatLabel(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function maskAccountNumber(value) {
  const s = String(value || "").trim();
  if (!s) return "—";
  if (s.length <= 4) return s;
  return `••••${s.slice(-4)}`;
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

export function emptyBankForm() {
  return {
    bankName: "",
    accountHolderName: "",
    accountNumber: "",
    iban: "",
    branchName: "",
    accountDetails: "",
    isActive: true,
  };
}

export function bankToFormValues(bank) {
  const base = emptyBankForm();
  if (!bank) return base;
  return {
    ...base,
    bankName: bank.bankName ?? "",
    accountHolderName: bank.accountHolderName ?? "",
    accountNumber: bank.accountNumber ?? "",
    iban: bank.iban ?? "",
    branchName: bank.branchName ?? "",
    accountDetails: bank.accountDetails ?? "",
    isActive: bank.isActive !== false,
  };
}

export function buildBankPayload(values) {
  const payload = {
    bankName: String(values.bankName || "").trim(),
    accountHolderName: String(values.accountHolderName || "").trim(),
    accountNumber: String(values.accountNumber || "").trim(),
    isActive: Boolean(values.isActive),
  };

  for (const key of ["iban", "branchName", "accountDetails"]) {
    const trimmed = String(values[key] || "").trim();
    payload[key] = trimmed === "" ? null : trimmed;
  }

  return payload;
}

export function validateBankForm(values) {
  const errors = {};
  if (!String(values.bankName || "").trim()) {
    errors.bankName = "Bank name is required";
  }
  if (!String(values.accountHolderName || "").trim()) {
    errors.accountHolderName = "Account holder name is required";
  }
  if (!String(values.accountNumber || "").trim()) {
    errors.accountNumber = "Account number is required";
  }
  return errors;
}
