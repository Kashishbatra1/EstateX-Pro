function Field({ label, error, children, hint }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="form-hint">{hint}</span> : null}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export default function BudgetForm({
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
        <h3 className="form-section__title">Budget</h3>
        <div className="form-grid">
          <Field label="Name *" error={errors.name}>
            <input
              type="text"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              disabled={submitting}
              required
              maxLength={150}
              placeholder="Office ops — June"
            />
          </Field>
          <Field label="Period type *" error={errors.periodType}>
            <select
              value={values.periodType}
              onChange={(e) => set("periodType", e.target.value)}
              disabled={submitting}
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </Field>
          <Field label="Year *" error={errors.year}>
            <input
              type="number"
              min="2000"
              max="2100"
              value={values.year}
              onChange={(e) => set("year", e.target.value)}
              disabled={submitting}
              required
            />
          </Field>
          {values.periodType === "monthly" ? (
            <Field label="Month *" error={errors.month}>
              <select
                value={values.month}
                onChange={(e) => set("month", e.target.value)}
                disabled={submitting}
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Total amount *" error={errors.totalAmount}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.totalAmount}
              onChange={(e) => set("totalAmount", e.target.value)}
              disabled={submitting}
              required
            />
          </Field>
          <Field
            label="Alert threshold %"
            error={errors.alertThresholdPct}
            hint="Notify when spent reaches this % of total"
          >
            <input
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={values.alertThresholdPct}
              onChange={(e) => set("alertThresholdPct", e.target.value)}
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
        </div>
      </section>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save budget"}
        </button>
      </div>
    </form>
  );
}
