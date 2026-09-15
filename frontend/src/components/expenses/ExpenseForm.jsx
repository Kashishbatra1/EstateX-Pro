import {
  REIMBURSEMENT_STATUSES,
  formatLabel,
} from "../../utils/expenseHelpers.js";

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

export default function ExpenseForm({
  values,
  errors = {},
  submitting = false,
  mode = "create",
  categories = [],
  employees = [],
  vendors = [],
  properties = [],
  paymentMethods = [],
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
        <h3 className="form-section__title">Required</h3>
        <div className="form-grid">
          <Field
            label="Category *"
            error={errors.categoryId}
            hint={
              categories.length
                ? "Select a category from the list"
                : "Enter the category ID from expense categories"
            }
          >
            {categories.length > 0 ? (
              <select
                value={
                  categories.some(
                    (c) => String(c.id) === String(values.categoryId)
                  )
                    ? values.categoryId
                    : ""
                }
                onChange={(e) => set("categoryId", e.target.value)}
                disabled={submitting}
              >
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (#{c.id})
                  </option>
                ))}
              </select>
            ) : null}
            <input
              type="number"
              min="1"
              value={values.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              disabled={submitting}
              placeholder="Category ID"
            />
          </Field>
          <Field
            label="Paid by employee *"
            error={errors.paidByEmployeeId}
            hint={
              employees.length
                ? "Select the employee who paid"
                : "Enter the employee ID"
            }
          >
            {employees.length > 0 ? (
              <select
                value={
                  employees.some(
                    (e) => String(e.id) === String(values.paidByEmployeeId)
                  )
                    ? values.paidByEmployeeId
                    : ""
                }
                onChange={(e) => set("paidByEmployeeId", e.target.value)}
                disabled={submitting}
              >
                <option value="">Select employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} (#{e.id})
                  </option>
                ))}
              </select>
            ) : null}
            <input
              type="number"
              min="1"
              value={values.paidByEmployeeId}
              onChange={(e) => set("paidByEmployeeId", e.target.value)}
              disabled={submitting}
              placeholder="Employee ID"
            />
          </Field>
          <Field label="Amount *" error={errors.amount}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={values.amount}
              onChange={(e) => set("amount", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Expense date" error={errors.expenseDate}>
            <input
              type="date"
              value={values.expenseDate}
              onChange={(e) => set("expenseDate", e.target.value)}
              disabled={submitting}
            />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Optional details</h3>
        <div className="form-grid">
          <Field label="Subcategory id" error={errors.subcategoryId}>
            <input
              type="number"
              min="1"
              value={values.subcategoryId}
              onChange={(e) => set("subcategoryId", e.target.value)}
              disabled={submitting}
              placeholder="Must belong to category"
            />
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
            ) : null}
            <input
              type="number"
              min="1"
              value={values.vendorId}
              onChange={(e) => set("vendorId", e.target.value)}
              disabled={submitting}
              placeholder="Vendor ID (optional)"
            />
          </Field>
          <Field label="GST / sales tax" error={errors.gstSalesTax}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.gstSalesTax}
              onChange={(e) => set("gstSalesTax", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Remaining amount" error={errors.remainingAmount}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.remainingAmount}
              onChange={(e) => set("remainingAmount", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Payment method" error={errors.paymentMethodId}>
            <select
              value={values.paymentMethodId}
              onChange={(e) => set("paymentMethodId", e.target.value)}
              disabled={submitting}
            >
              <option value="">None</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.methodName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Property" error={errors.propertyId}>
            <select
              value={values.propertyId}
              onChange={(e) => set("propertyId", e.target.value)}
              disabled={submitting}
            >
              <option value="">None</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.propertyCode || `#${p.id}`} — {p.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reimbursement status" error={errors.reimbursementStatus}>
            <select
              value={values.reimbursementStatus}
              onChange={(e) => set("reimbursementStatus", e.target.value)}
              disabled={submitting}
            >
              {REIMBURSEMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatLabel(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Receipt path / URL" error={errors.receiptPath}>
            <input
              value={values.receiptPath}
              onChange={(e) => set("receiptPath", e.target.value)}
              disabled={submitting}
            />
          </Field>
        </div>
        <Field label="Description" error={errors.description}>
          <textarea
            rows={3}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            disabled={submitting}
          />
        </Field>
        <div className="form-grid">
          <Field label="Device / item name" error={errors.deviceOrItemName}>
            <input
              value={values.deviceOrItemName}
              onChange={(e) => set("deviceOrItemName", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field
            label="Quantity"
            error={errors.quantity}
            hint="Required when device/item name is set"
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
        </div>
        {mode === "create" ? (
          <p className="form-hint">
            New expenses are created with approval status{" "}
            <strong>requested</strong>. Approve or reject from the expense
            detail page.
          </p>
        ) : (
          <p className="form-hint">
            Only <strong>requested</strong> expenses can be edited. Approval is
            managed separately.
          </p>
        )}
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
              ? "Create expense"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
