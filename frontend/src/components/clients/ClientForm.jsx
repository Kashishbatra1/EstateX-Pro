import {
  CLIENT_TYPES,
  WHATSAPP_PREFERENCES,
  formatLabel,
} from "../../utils/clientHelpers.js";

function Field({ label, error, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

export default function ClientForm({
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
        <h3 className="form-section__title">Basic information</h3>
        <div className="form-grid">
          <Field label="Client name *" error={errors.clientName}>
            <input
              value={values.clientName}
              onChange={(e) => set("clientName", e.target.value)}
              disabled={submitting}
              aria-invalid={Boolean(errors.clientName)}
            />
          </Field>
          <Field label="Client type *" error={errors.clientType}>
            <select
              value={values.clientType}
              onChange={(e) => set("clientType", e.target.value)}
              disabled={submitting}
            >
              {CLIENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {formatLabel(t)}
                </option>
              ))}
            </select>
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
          <Field label="CNIC" error={errors.cnic}>
            <input
              value={values.cnic}
              onChange={(e) => set("cnic", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="WhatsApp / SMS preference" error={errors.whatsappSmsPreference}>
            <select
              value={values.whatsappSmsPreference}
              onChange={(e) => set("whatsappSmsPreference", e.target.value)}
              disabled={submitting}
            >
              {WHATSAPP_PREFERENCES.map((p) => (
                <option key={p} value={p}>
                  {formatLabel(p)}
                </option>
              ))}
            </select>
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
        <h3 className="form-section__title">Preferences & lead</h3>
        <div className="form-grid">
          <Field label="Budget min" error={errors.budgetMin}>
            <input
              type="number"
              min="0"
              value={values.budgetMin}
              onChange={(e) => set("budgetMin", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Budget max" error={errors.budgetMax}>
            <input
              type="number"
              min="0"
              value={values.budgetMax}
              onChange={(e) => set("budgetMax", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Preferred property type" error={errors.preferredPropertyType}>
            <input
              value={values.preferredPropertyType}
              onChange={(e) => set("preferredPropertyType", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Preferred location" error={errors.preferredLocation}>
            <input
              value={values.preferredLocation}
              onChange={(e) => set("preferredLocation", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Investment preference" error={errors.investmentPreference}>
            <input
              value={values.investmentPreference}
              onChange={(e) => set("investmentPreference", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Lead source" error={errors.leadSource}>
            <input
              value={values.leadSource}
              onChange={(e) => set("leadSource", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Referral source" error={errors.referralSource}>
            <input
              value={values.referralSource}
              onChange={(e) => set("referralSource", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Client rating (0–5)" error={errors.clientRating}>
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={values.clientRating}
              onChange={(e) => set("clientRating", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Next follow-up" error={errors.nextFollowUpDate}>
            <input
              type="date"
              value={values.nextFollowUpDate}
              onChange={(e) => set("nextFollowUpDate", e.target.value)}
              disabled={submitting}
            />
          </Field>
        </div>
        <Field label="CRM notes" error={errors.crmNotes}>
          <textarea
            rows={4}
            value={values.crmNotes}
            onChange={(e) => set("crmNotes", e.target.value)}
            disabled={submitting}
          />
        </Field>
        {mode === "create" ? (
          <p className="form-hint">
            KYC document references and communication history can be managed
            from the client profile after creation.
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
              ? "Create client"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
