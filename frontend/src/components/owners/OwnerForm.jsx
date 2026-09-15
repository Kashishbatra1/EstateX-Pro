function Field({ label, error, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

export default function OwnerForm({
  values,
  errors = {},
  submitting = false,
  mode = "create",
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
        <h3 className="form-section__title">Owner details</h3>
        <div className="form-grid">
          <Field label="Owner name *" error={errors.ownerName}>
            <input
              value={values.ownerName}
              onChange={(e) => set("ownerName", e.target.value)}
              disabled={submitting}
              aria-invalid={Boolean(errors.ownerName)}
            />
          </Field>
          <Field label="CNIC" error={errors.cnic}>
            <input
              value={values.cnic}
              onChange={(e) => set("cnic", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <input
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
          <Field label="NTN" error={errors.ntn}>
            <input
              value={values.ntn}
              onChange={(e) => set("ntn", e.target.value)}
              disabled={submitting}
            />
          </Field>
        </div>
        <Field label="Address" error={errors.address}>
          <textarea
            rows={3}
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
            disabled={submitting}
          />
        </Field>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Nominee</h3>
        <div className="form-grid">
          <Field label="Nominee name" error={errors.nomineeName}>
            <input
              value={values.nomineeName}
              onChange={(e) => set("nomineeName", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Nominee CNIC" error={errors.nomineeCnic}>
            <input
              value={values.nomineeCnic}
              onChange={(e) => set("nomineeCnic", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Relation" error={errors.nomineeRelation}>
            <input
              value={values.nomineeRelation}
              onChange={(e) => set("nomineeRelation", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Nominee contact" error={errors.nomineeContact}>
            <input
              value={values.nomineeContact}
              onChange={(e) => set("nomineeContact", e.target.value)}
              disabled={submitting}
            />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Power of attorney</h3>
        <div className="form-grid">
          <Field label="POA holder" error={errors.poaHolderName}>
            <input
              value={values.poaHolderName}
              onChange={(e) => set("poaHolderName", e.target.value)}
              disabled={submitting}
            />
          </Field>
        </div>
        <Field label="POA details" error={errors.poaDetails}>
          <textarea
            rows={3}
            value={values.poaDetails}
            onChange={(e) => set("poaDetails", e.target.value)}
            disabled={submitting}
          />
        </Field>
        <Field label="Notes" error={errors.notes}>
          <textarea
            rows={3}
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            disabled={submitting}
          />
        </Field>
        {mode === "create" ? (
          <p className="form-hint">
            New owners start as <strong>unverified</strong>. Verification is
            managed from the owner details page.
          </p>
        ) : null}
      </section>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn--primary btn--inline"
          disabled={submitting}
        >
          {submitting
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create owner"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
