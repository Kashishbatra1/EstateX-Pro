export function formatApiError(err) {
  if (!err) return "Something went wrong";
  if (err.details?.length) {
    return err.details.map((d) => d.message || d.field).join("; ");
  }
  return err.message || "Something went wrong";
}

export function emptyVendorForm() {
  return {
    vendorName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    services: "",
    contractStartDate: "",
    contractEndDate: "",
    paymentTerms: "",
    isPreferred: false,
    outstandingBalance: "0",
    notes: "",
  };
}

export function vendorToForm(vendor) {
  return {
    vendorName: vendor?.vendorName || "",
    contactPerson: vendor?.contactPerson || "",
    phone: vendor?.phone || "",
    email: vendor?.email || "",
    address: vendor?.address || "",
    services: vendor?.services || "",
    contractStartDate: vendor?.contractStartDate
      ? String(vendor.contractStartDate).slice(0, 10)
      : "",
    contractEndDate: vendor?.contractEndDate
      ? String(vendor.contractEndDate).slice(0, 10)
      : "",
    paymentTerms: vendor?.paymentTerms || "",
    isPreferred: Boolean(vendor?.isPreferred),
    outstandingBalance:
      vendor?.outstandingBalance != null
        ? String(vendor.outstandingBalance)
        : "0",
    notes: vendor?.notes || "",
  };
}

export function buildVendorPayload(values) {
  return {
    vendorName: values.vendorName.trim(),
    contactPerson: values.contactPerson.trim() || null,
    phone: values.phone.trim() || null,
    email: values.email.trim() || null,
    address: values.address.trim() || null,
    services: values.services.trim() || null,
    contractStartDate: values.contractStartDate || null,
    contractEndDate: values.contractEndDate || null,
    paymentTerms: values.paymentTerms.trim() || null,
    isPreferred: Boolean(values.isPreferred),
    outstandingBalance:
      values.outstandingBalance === ""
        ? 0
        : Number(values.outstandingBalance),
    notes: values.notes.trim() || null,
  };
}
