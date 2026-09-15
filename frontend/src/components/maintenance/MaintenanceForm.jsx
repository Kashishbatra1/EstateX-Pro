import {
  STATUSES,
  PRIORITIES,
  formatStatus,
  formatPriority,
} from "../../utils/maintenanceHelpers.js";

function Field({ label, error, children, hint, className = "" }) {
  return (
    <label className={`field ${className}`.trim()}>
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="form-hint">{hint}</span> : null}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

export default function MaintenanceForm({
  values,
  errors = {},
  submitting = false,
  properties = [],
  employees = [],
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
        <h3 className="form-section__title">Task details</h3>
        <div className="form-grid">
          <Field label="Property *" error={errors.propertyId}>
            <select
              value={values.propertyId}
              onChange={(e) => set("propertyId", e.target.value)}
              disabled={submitting}
              required
            >
              <option value="">Select property…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.propertyCode ? `${p.propertyCode} — ` : ""}
                  {p.title || `#${p.id}`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title *" error={errors.title}>
            <input
              type="text"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              disabled={submitting}
              required
              maxLength={200}
              placeholder="e.g. AC service, plumbing repair"
            />
          </Field>
          <Field label="Category" error={errors.category}>
            <input
              type="text"
              value={values.category}
              onChange={(e) => set("category", e.target.value)}
              disabled={submitting}
              placeholder="Plumbing, electrical, HVAC…"
            />
          </Field>
          <Field
            label="Description"
            error={errors.description}
            className="form-grid__full"
          >
            <textarea
              rows={3}
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              disabled={submitting}
              placeholder="What needs to be done?"
            />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Schedule</h3>
        <div className="form-grid">
          <Field label="Due date *" error={errors.dueDate}>
            <input
              type="date"
              value={values.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
              disabled={submitting}
              required
            />
          </Field>
          <Field label="Status" error={errors.status}>
            <select
              value={values.status}
              onChange={(e) => set("status", e.target.value)}
              disabled={submitting}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatStatus(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority" error={errors.priority}>
            <select
              value={values.priority}
              onChange={(e) => set("priority", e.target.value)}
              disabled={submitting}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {formatPriority(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Reminder days before"
            error={errors.reminderDaysBefore}
            hint="Notification before the due date"
          >
            <input
              type="number"
              min="0"
              value={values.reminderDaysBefore}
              onChange={(e) => set("reminderDaysBefore", e.target.value)}
              disabled={submitting}
            />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Assignment & cost</h3>
        <div className="form-grid">
          <Field label="Assigned to" error={errors.assignedTo}>
            <select
              value={values.assignedTo}
              onChange={(e) => set("assignedTo", e.target.value)}
              disabled={submitting}
            >
              <option value="">Unassigned</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName || e.name || `Employee #${e.id}`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vendor" error={errors.vendorId}>
            <select
              value={values.vendorId}
              onChange={(e) => set("vendorId", e.target.value)}
              disabled={submitting}
            >
              <option value="">None</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendorName || v.name || `Vendor #${v.id}`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estimated cost" error={errors.estimatedCost}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.estimatedCost}
              onChange={(e) => set("estimatedCost", e.target.value)}
              disabled={submitting}
              placeholder="0.00"
            />
          </Field>
          <Field label="Actual cost" error={errors.actualCost}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.actualCost}
              onChange={(e) => set("actualCost", e.target.value)}
              disabled={submitting}
              placeholder="0.00"
            />
          </Field>
          <Field label="Notes" error={errors.notes} className="form-grid__full">
            <textarea
              rows={2}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              disabled={submitting}
              placeholder="Internal notes"
            />
          </Field>
        </div>
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
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save task"}
        </button>
      </div>
    </form>
  );
}
