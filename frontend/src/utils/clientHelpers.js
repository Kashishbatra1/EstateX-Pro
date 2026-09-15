export const CLIENT_TYPES = ["buyer", "seller", "both"];

export const WHATSAPP_PREFERENCES = ["none", "whatsapp", "sms", "both"];

export const COMMUNICATION_TYPES = [
  "note",
  "call",
  "email",
  "whatsapp",
  "sms",
  "meeting",
];

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

export function emptyClientForm() {
  return {
    clientName: "",
    cnic: "",
    phone: "",
    email: "",
    address: "",
    clientType: "buyer",
    budgetMin: "",
    budgetMax: "",
    investmentPreference: "",
    preferredPropertyType: "",
    preferredLocation: "",
    leadSource: "",
    referralSource: "",
    crmNotes: "",
    whatsappSmsPreference: "none",
    clientRating: "",
    nextFollowUpDate: "",
  };
}

export function clientToFormValues(client) {
  const base = emptyClientForm();
  if (!client) return base;
  return {
    ...base,
    clientName: client.clientName ?? "",
    cnic: client.cnic ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    address: client.address ?? "",
    clientType: client.clientType || "buyer",
    budgetMin: client.budgetMin ?? "",
    budgetMax: client.budgetMax ?? "",
    investmentPreference: client.investmentPreference ?? "",
    preferredPropertyType: client.preferredPropertyType ?? "",
    preferredLocation: client.preferredLocation ?? "",
    leadSource: client.leadSource ?? "",
    referralSource: client.referralSource ?? "",
    crmNotes: client.crmNotes ?? "",
    whatsappSmsPreference: client.whatsappSmsPreference || "none",
    clientRating: client.clientRating ?? "",
    nextFollowUpDate: client.nextFollowUpDate
      ? String(client.nextFollowUpDate).slice(0, 10)
      : "",
  };
}

export function buildClientPayload(values) {
  const payload = {
    clientName: String(values.clientName || "").trim(),
    clientType: values.clientType || "buyer",
    whatsappSmsPreference: values.whatsappSmsPreference || "none",
  };

  const optionalStrings = [
    "cnic",
    "phone",
    "email",
    "address",
    "investmentPreference",
    "preferredPropertyType",
    "preferredLocation",
    "leadSource",
    "referralSource",
    "crmNotes",
  ];

  for (const key of optionalStrings) {
    const trimmed = String(values[key] ?? "").trim();
    payload[key] = trimmed === "" ? null : trimmed;
  }

  for (const key of ["budgetMin", "budgetMax", "clientRating"]) {
    const raw = values[key];
    if (raw === undefined || raw === null || String(raw).trim() === "") {
      payload[key] = null;
      continue;
    }
    const num = Number(raw);
    if (!Number.isNaN(num)) payload[key] = num;
  }

  const followUp = String(values.nextFollowUpDate || "").trim();
  payload.nextFollowUpDate = followUp === "" ? null : followUp;

  return payload;
}

export function validateClientForm(values) {
  const errors = {};
  const name = String(values.clientName || "").trim();
  if (!name) errors.clientName = "Client name is required";
  else if (name.length > 150) {
    errors.clientName = "Client name must be at most 150 characters";
  }

  if (!CLIENT_TYPES.includes(values.clientType)) {
    errors.clientType = "Client type is required";
  }

  const email = String(values.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Email format is invalid";
  }

  const cnic = String(values.cnic || "").trim();
  if (cnic && cnic.length > 20) {
    errors.cnic = "CNIC must be at most 20 characters";
  }

  const budgetMin =
    String(values.budgetMin || "").trim() === ""
      ? null
      : Number(values.budgetMin);
  const budgetMax =
    String(values.budgetMax || "").trim() === ""
      ? null
      : Number(values.budgetMax);

  if (budgetMin !== null && (Number.isNaN(budgetMin) || budgetMin < 0)) {
    errors.budgetMin = "Must be a non-negative number";
  }
  if (budgetMax !== null && (Number.isNaN(budgetMax) || budgetMax < 0)) {
    errors.budgetMax = "Must be a non-negative number";
  }
  if (
    budgetMin !== null &&
    budgetMax !== null &&
    !Number.isNaN(budgetMin) &&
    !Number.isNaN(budgetMax) &&
    budgetMax < budgetMin
  ) {
    errors.budgetMax = "Budget max must be greater than or equal to budget min";
  }

  const rating =
    String(values.clientRating || "").trim() === ""
      ? null
      : Number(values.clientRating);
  if (rating !== null && (Number.isNaN(rating) || rating < 0 || rating > 5)) {
    errors.clientRating = "Rating must be between 0 and 5";
  }

  return errors;
}

export function formatBudget(min, max, formatMoney) {
  if (min == null && max == null) return "—";
  if (min != null && max != null) {
    return `${formatMoney(min)} – ${formatMoney(max)}`;
  }
  if (min != null) return `From ${formatMoney(min)}`;
  return `Up to ${formatMoney(max)}`;
}
