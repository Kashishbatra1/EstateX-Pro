function Field({ label, error, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

export default function VendorForm({
  values,
  errors = {},
  submitting = false,
  onChange,
  onSubmit,
  onCancel,
}) {
  function set(field, value) {
    onChange({ ...values, [field]: value });
  }

  return (
    <form className="property-form" onSubmit={onSubmit} noValidate>
      <section className="form-section">
        <h3 className="form-section__title">Vendor</h3>
        <div className="form-grid">
          <Field label="Vendor name *" error={errors.vendorName}>
            <input
              type="text"
              value={values.vendorName}
              onChange={(e) => set("vendorName", e.target.value)}
              disabled={submitting}
              required
            />
          </Field>
          <Field label="Contact person" error={errors.contactPerson}>
            <input
              type="text"
              value={values.contactPerson}
              onChange={(e) => set("contactPerson", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <input
              type="text"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Email" error={errors.email}>
            <input
              type="email"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Services" error={errors.services}>
            <input
              type="text"
              value={values.services}
              onChange={(e) => set("services", e.target.value)}
              disabled={submitting}
              placeholder="AC repair, cleaning…"
            />
          </Field>
          <Field label="Outstanding balance" error={errors.outstandingBalance}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.outstandingBalance}
              onChange={(e) => set("outstandingBalance", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Contract start" error={errors.contractStartDate}>
            <input
              type="date"
              value={values.contractStartDate}
              onChange={(e) => set("contractStartDate", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Contract end" error={errors.contractEndDate}>
            <input
              type="date"
              value={values.contractEndDate}
              onChange={(e) => set("contractEndDate", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Payment terms" error={errors.paymentTerms}>
            <input
              type="text"
              value={values.paymentTerms}
              onChange={(e) => set("paymentTerms", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Address" error={errors.address}>
            <input
              type="text"
              value={values.address}
              onChange={(e) => set("address", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <label className="docs-check">
            <input
              type="checkbox"
              checked={values.isPreferred}
              onChange={(e) => set("isPreferred", e.target.checked)}
              disabled={submitting}
            />
            Preferred vendor
          </label>
          <Field label="Notes" error={errors.notes}>
            <input
              type="text"
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              disabled={submitting}
            />
          </Field>
        </div>
      </section>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save vendor"}
        </button>
      </div>
    </form>
  );
}
