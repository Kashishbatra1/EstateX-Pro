import { FREQUENCIES, formatFrequency } from "../../utils/recurringHelpers.js";

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

export default function RecurringForm({
  values,
  errors = {},
  submitting = false,
  categories = [],
  vendors = [],
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
        <h3 className="form-section__title">Recurring expense</h3>
        <div className="form-grid">
          <Field label="Title *" error={errors.title}>
            <input
              type="text"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              disabled={submitting}
              required
              maxLength={150}
              placeholder="Office rent, internet…"
            />
          </Field>
          <Field label="Amount *" error={errors.amount}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.amount}
              onChange={(e) => set("amount", e.target.value)}
              disabled={submitting}
              required
            />
          </Field>
          <Field label="Frequency *" error={errors.frequency}>
            <select
              value={values.frequency}
              onChange={(e) => set("frequency", e.target.value)}
              disabled={submitting}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {formatFrequency(f)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Due day (1–28)"
            error={errors.dueDay}
            hint="Day of month for monthly schedules"
          >
            <input
              type="number"
              min="1"
              max="28"
              value={values.dueDay}
              onChange={(e) => set("dueDay", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Next due date" error={errors.nextDueDate}>
            <input
              type="date"
              value={values.nextDueDate}
              onChange={(e) => set("nextDueDate", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Remind days before" error={errors.reminderDaysBefore}>
            <input
              type="number"
              min="0"
              value={values.reminderDaysBefore}
              onChange={(e) => set("reminderDaysBefore", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field
            label="Category"
            error={errors.categoryId}
            hint={
              categories.length
                ? "Optional expense category"
                : "Enter expense_categories.id if known"
            }
          >
            {categories.length > 0 ? (
              <select
                value={
                  categories.some((c) => String(c.id) === String(values.categoryId))
                    ? values.categoryId
                    : ""
                }
                onChange={(e) => set("categoryId", e.target.value)}
                disabled={submitting}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (#{c.id})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min="1"
                value={values.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                disabled={submitting}
                placeholder="expense_categories.id"
              />
            )}
          </Field>
          <Field label="Vendor" error={errors.vendorId}>
            {vendors.length > 0 ? (
              <select
                value={
                  vendors.some((v) => String(v.id) === String(values.vendorId))
                    ? values.vendorId
                    : ""
                }
                onChange={(e) => set("vendorId", e.target.value)}
                disabled={submitting}
              >
                <option value="">No vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vendorName || v.name} (#{v.id})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min="1"
                value={values.vendorId}
                onChange={(e) => set("vendorId", e.target.value)}
                disabled={submitting}
                placeholder="vendors.id"
              />
            )}
          </Field>
          <Field label="Annual escalation %" error={errors.annualEscalationPct}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.annualEscalationPct}
              onChange={(e) => set("annualEscalationPct", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <label className="docs-check">
            <input
              type="checkbox"
              checked={values.autoDebitFlag}
              onChange={(e) => set("autoDebitFlag", e.target.checked)}
              disabled={submitting}
            />
            Auto-debit flag
          </label>
          <label className="docs-check">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              disabled={submitting}
            />
            Active
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
          {submitting ? "Saving…" : "Save recurring expense"}
        </button>
      </div>
    </form>
  );
}
