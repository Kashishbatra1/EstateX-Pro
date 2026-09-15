import { INVENTORY_STATUSES, formatLabel } from "../../utils/inventoryHelpers.js";

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

export default function InventoryForm({
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
        <h3 className="form-section__title">Item details</h3>
        <div className="form-grid">
          <Field label="Item name *" error={errors.itemName}>
            <input
              type="text"
              value={values.itemName}
              onChange={(e) => set("itemName", e.target.value)}
              disabled={submitting}
              required
              placeholder="Laptop, AC, Printer…"
            />
          </Field>
          <Field label="Item type" error={errors.itemType}>
            <input
              type="text"
              value={values.itemType}
              onChange={(e) => set("itemType", e.target.value)}
              disabled={submitting}
              placeholder="Device"
            />
          </Field>
          <Field
            label="Quantity *"
            error={errors.quantity}
            hint={
              mode === "create"
                ? "Initial quantity in office (records a purchase txn if > 0)"
                : "Prefer Adjust on the detail page for stock changes"
            }
          >
            <input
              type="number"
              min="0"
              step="1"
              value={values.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Unit" error={errors.unit}>
            <input
              type="text"
              value={values.unit}
              onChange={(e) => set("unit", e.target.value)}
              disabled={submitting}
              placeholder="pcs"
            />
          </Field>
          {mode === "edit" ? (
            <Field label="Status" error={errors.status}>
              <select
                value={values.status}
                onChange={(e) => set("status", e.target.value)}
                disabled={submitting}
              >
                {INVENTORY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {formatLabel(s)}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Purchase date" error={errors.purchaseDate}>
            <input
              type="date"
              value={values.purchaseDate}
              onChange={(e) => set("purchaseDate", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Purchase cost" error={errors.purchaseCost}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.purchaseCost}
              onChange={(e) => set("purchaseCost", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Location notes" error={errors.locationNotes}>
            <input
              type="text"
              value={values.locationNotes}
              onChange={(e) => set("locationNotes", e.target.value)}
              disabled={submitting}
            />
          </Field>
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
          className="btn btn--primary"
          disabled={submitting}
        >
          {submitting
            ? "Saving…"
            : mode === "edit"
              ? "Save changes"
              : "Create item"}
        </button>
      </div>
    </form>
  );
}
