function Field({ label, error, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

export default function BankForm({
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
        <h3 className="form-section__title">Bank account</h3>
        <div className="form-grid">
          <Field label="Bank name *" error={errors.bankName}>
            <input
              value={values.bankName}
              onChange={(e) => set("bankName", e.target.value)}
              disabled={submitting}
              aria-invalid={Boolean(errors.bankName)}
            />
          </Field>
          <Field label="Account holder *" error={errors.accountHolderName}>
            <input
              value={values.accountHolderName}
              onChange={(e) => set("accountHolderName", e.target.value)}
              disabled={submitting}
              aria-invalid={Boolean(errors.accountHolderName)}
            />
          </Field>
          <Field label="Account number *" error={errors.accountNumber}>
            <input
              value={values.accountNumber}
              onChange={(e) => set("accountNumber", e.target.value)}
              disabled={submitting}
              aria-invalid={Boolean(errors.accountNumber)}
              autoComplete="off"
            />
          </Field>
          <Field label="IBAN" error={errors.iban}>
            <input
              value={values.iban}
              onChange={(e) => set("iban", e.target.value)}
              disabled={submitting}
              autoComplete="off"
            />
          </Field>
          <Field label="Branch" error={errors.branchName}>
            <input
              value={values.branchName}
              onChange={(e) => set("branchName", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Active" error={errors.isActive}>
            <select
              value={values.isActive ? "true" : "false"}
              onChange={(e) => set("isActive", e.target.value === "true")}
              disabled={submitting}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </Field>
        </div>
        <Field label="Account details" error={errors.accountDetails}>
          <textarea
            rows={3}
            value={values.accountDetails}
            onChange={(e) => set("accountDetails", e.target.value)}
            disabled={submitting}
          />
        </Field>
        {mode === "create" ? (
          <p className="form-hint">
            Active bank accounts can be linked to properties for listing
            readiness.
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
              ? "Create bank account"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
