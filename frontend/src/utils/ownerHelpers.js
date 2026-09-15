export const VERIFICATION_STATUSES = ["unverified", "verified", "rejected"];

export function formatLabel(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function maskCnic(value) {
  const s = String(value || "").trim();
  if (!s) return "—";
  if (s.length <= 5) return s;
  return `${s.slice(0, 5)}••••${s.slice(-2)}`;
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

export function emptyOwnerForm() {
  return {
    ownerName: "",
    cnic: "",
    phone: "",
    email: "",
    address: "",
    ntn: "",
    nomineeName: "",
    nomineeCnic: "",
    nomineeRelation: "",
    nomineeContact: "",
    poaHolderName: "",
    poaDetails: "",
    notes: "",
  };
}

export function ownerToFormValues(owner) {
  const base = emptyOwnerForm();
  if (!owner) return base;
  return {
    ...base,
    ownerName: owner.ownerName ?? "",
    cnic: owner.cnic ?? "",
    phone: owner.phone ?? "",
    email: owner.email ?? "",
    address: owner.address ?? "",
    ntn: owner.ntn ?? "",
    nomineeName: owner.nomineeName ?? "",
    nomineeCnic: owner.nomineeCnic ?? "",
    nomineeRelation: owner.nomineeRelation ?? "",
    nomineeContact: owner.nomineeContact ?? "",
    poaHolderName: owner.poaHolderName ?? "",
    poaDetails: owner.poaDetails ?? "",
    notes: owner.notes ?? "",
  };
}

export function buildOwnerPayload(values) {
  const payload = {
    ownerName: String(values.ownerName || "").trim(),
  };

  const optional = [
    "cnic",
    "phone",
    "email",
    "address",
    "ntn",
    "nomineeName",
    "nomineeCnic",
    "nomineeRelation",
    "nomineeContact",
    "poaHolderName",
    "poaDetails",
    "notes",
  ];

  for (const key of optional) {
    const raw = values[key];
    if (raw === undefined || raw === null) continue;
    const trimmed = String(raw).trim();
    payload[key] = trimmed === "" ? null : trimmed;
  }

  return payload;
}

export function validateOwnerForm(values) {
  const errors = {};
  const name = String(values.ownerName || "").trim();
  if (!name) errors.ownerName = "Owner name is required";
  else if (name.length > 150) {
    errors.ownerName = "Owner name must be at most 150 characters";
  }

  const email = String(values.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Email format is invalid";
  }

  const cnic = String(values.cnic || "").trim();
  if (cnic && cnic.length > 20) {
    errors.cnic = "CNIC must be at most 20 characters";
  }

  return errors;
}
