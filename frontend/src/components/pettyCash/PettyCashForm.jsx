function Field({ label, error, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

export default function PettyCashForm({
  values,
  errors = {},
  submitting = false,
  employees = [],
  showActive = false,
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
        <h3 className="form-section__title">Petty cash account</h3>
        <div className="form-grid">
          <Field label="Account name *" error={errors.accountName}>
            <input
              type="text"
              value={values.accountName}
              onChange={(e) => set("accountName", e.target.value)}
              disabled={submitting}
              required
              maxLength={150}
            />
          </Field>
          <Field label="Custodian *" error={errors.custodianEmployeeId}>
            <select
              value={values.custodianEmployeeId}
              onChange={(e) => set("custodianEmployeeId", e.target.value)}
              disabled={submitting}
              required
            >
              <option value="">Select employee…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName || e.name || `#${e.id}`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Float amount" error={errors.floatAmount}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.floatAmount}
              onChange={(e) => set("floatAmount", e.target.value)}
              disabled={submitting}
            />
          </Field>
          {showActive ? (
            <Field label="Active">
              <select
                value={values.isActive ? "true" : "false"}
                onChange={(e) => set("isActive", e.target.value === "true")}
                disabled={submitting}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          ) : null}
          <Field label="Notes" error={errors.notes}>
            <textarea
              rows={3}
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
          {submitting ? "Saving…" : "Save account"}
        </button>
      </div>
    </form>
  );
}
