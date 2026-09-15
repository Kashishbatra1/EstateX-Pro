import {
  PROPERTY_CATEGORIES,
  PROPERTY_PURPOSES,
  PROPERTY_TYPE_OPTIONS,
  UNIT_LAYOUT_OPTIONS,
  COUNT_1_TO_3,
  AREA_UNITS,
  FACING_DIRECTIONS,
  FURNISHING_STATUSES,
  POSSESSION_STATUSES,
  OWNERSHIP_TYPES,
  LEGAL_STATUSES,
  NOC_STATUSES,
  FEATURE_FLAGS,
  WATER_SUPPLY_OPTIONS,
  formatLabel,
} from "../../utils/propertyHelpers.js";

function Field({ label, error, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

export default function PropertyForm({
  values,
  errors = {},
  paymentMethods = [],
  bankAccounts = [],
  submitting = false,
  mode = "create",
  onChange,
  onSubmit,
  onCancel,
}) {
  const isRent = values.purpose === "rent";

  function set(field, value) {
    onChange({ ...values, [field]: value });
  }

  function setFeature(field, value) {
    onChange({
      ...values,
      features: {
        ...(values.features || {}),
        [field]: value,
      },
    });
  }

  const features = values.features || {};

  return (
    <form className="property-form" onSubmit={onSubmit} noValidate>
      <section className="form-section">
        <h3 className="form-section__title">Basics</h3>
        <div className="form-grid">
          <Field label="Title *" error={errors.title}>
            <input
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              disabled={submitting}
              aria-invalid={Boolean(errors.title)}
            />
          </Field>
          <Field label="Property code" error={errors.propertyCode}>
            <input
              value={values.propertyCode}
              onChange={(e) => set("propertyCode", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Purpose *" error={errors.purpose}>
            <select
              value={values.purpose}
              onChange={(e) => set("purpose", e.target.value)}
              disabled={submitting}
            >
              {PROPERTY_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {formatLabel(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category *" error={errors.category}>
            <select
              value={values.category}
              onChange={(e) => set("category", e.target.value)}
              disabled={submitting}
            >
              {PROPERTY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {formatLabel(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Property type" error={errors.propertyType}>
            <select
              value={values.propertyType}
              onChange={(e) => set("propertyType", e.target.value)}
              disabled={submitting}
            >
              <option value="">Select…</option>
              {PROPERTY_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {values.propertyType &&
              !PROPERTY_TYPE_OPTIONS.includes(values.propertyType) ? (
                <option value={values.propertyType}>
                  {values.propertyType}
                </option>
              ) : null}
            </select>
          </Field>
          <Field label="Layout" error={errors.listingType}>
            <select
              value={values.listingType}
              onChange={(e) => set("listingType", e.target.value)}
              disabled={submitting}
            >
              <option value="">Select…</option>
              {UNIT_LAYOUT_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {values.listingType &&
              !UNIT_LAYOUT_OPTIONS.includes(values.listingType) ? (
                <option value={values.listingType}>{values.listingType}</option>
              ) : null}
            </select>
          </Field>
        </div>
        <Field label="Description" error={errors.description}>
          <textarea
            rows={4}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            disabled={submitting}
          />
        </Field>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Location</h3>
        <div className="form-grid">
          <Field label="City" error={errors.city}>
            <input
              value={values.city}
              onChange={(e) => set("city", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Area" error={errors.area}>
            <input
              value={values.area}
              onChange={(e) => set("area", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Society" error={errors.society}>
            <input
              value={values.society}
              onChange={(e) => set("society", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Block" error={errors.block}>
            <input
              value={values.block}
              onChange={(e) => set("block", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Street" error={errors.street}>
            <input
              value={values.street}
              onChange={(e) => set("street", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Flat / plot number" error={errors.flatOrPlotNumber}>
            <input
              value={values.flatOrPlotNumber}
              onChange={(e) => set("flatOrPlotNumber", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Google Maps URL" error={errors.googleMapsUrl}>
            <input
              value={values.googleMapsUrl}
              onChange={(e) => set("googleMapsUrl", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Nearby landmarks" error={errors.nearbyLandmarks}>
            <input
              value={values.nearbyLandmarks}
              onChange={(e) => set("nearbyLandmarks", e.target.value)}
              disabled={submitting}
            />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Financial details</h3>
        <div className="form-grid">
          <Field label="Payment type" error={errors.primaryPaymentMethodId}>
            <select
              value={values.primaryPaymentMethodId ?? ""}
              onChange={(e) => set("primaryPaymentMethodId", e.target.value)}
              disabled={submitting}
            >
              <option value="">Select…</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.methodName || m.name || `Method #${m.id}`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Owner bank account" error={errors.primaryBankAccountId}>
            <select
              value={values.primaryBankAccountId ?? ""}
              onChange={(e) => set("primaryBankAccountId", e.target.value)}
              disabled={submitting}
            >
              <option value="">Select…</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} — {b.accountHolderName}
                  {b.accountNumber
                    ? ` (••••${String(b.accountNumber).slice(-4)})`
                    : ""}
                </option>
              ))}
            </select>
          </Field>
          {!isRent ? (
            <Field label="Asking price" error={errors.askingPrice}>
              <input
                type="number"
                min="0"
                step="1"
                value={values.askingPrice ?? ""}
                onChange={(e) => set("askingPrice", e.target.value)}
                disabled={submitting}
              />
            </Field>
          ) : null}
          {isRent || mode === "edit" ? (
            <>
              <Field
                label={
                  isRent && mode === "create" ? "Monthly rent *" : "Monthly rent"
                }
                error={errors.monthlyRent}
              >
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={values.monthlyRent ?? ""}
                  onChange={(e) => set("monthlyRent", e.target.value)}
                  disabled={submitting}
                />
              </Field>
              <Field
                label={
                  isRent && mode === "create"
                    ? "Advance rent (months) *"
                    : "Advance rent (months)"
                }
                error={errors.advanceRentMonths}
              >
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={values.advanceRentMonths ?? ""}
                  onChange={(e) => set("advanceRentMonths", e.target.value)}
                  disabled={submitting}
                />
              </Field>
              <Field
                label={
                  isRent && mode === "create"
                    ? "Security deposit *"
                    : "Security deposit"
                }
                error={errors.securityDeposit}
              >
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={values.securityDeposit ?? ""}
                  onChange={(e) => set("securityDeposit", e.target.value)}
                  disabled={submitting}
                />
              </Field>
            </>
          ) : null}
        </div>
        <p className="form-hint">
          Installments and monthly installment amounts are set on the{" "}
          <strong>booking</strong> for this property (sale / booking plans).
          {mode === "create"
            ? " New properties are created as draft until listing prerequisites are met."
            : ""}
        </p>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Property details</h3>
        <div className="form-grid">
          <Field label="Year built" error={errors.yearBuilt}>
            <input
              type="number"
              min="1800"
              step="1"
              value={values.yearBuilt ?? ""}
              onChange={(e) => set("yearBuilt", e.target.value)}
              disabled={submitting}
              placeholder="e.g. 2018"
            />
          </Field>
          <Field label="Property age (years)" error={errors.propertyAgeYears}>
            <input
              type="number"
              min="0"
              step="1"
              value={values.propertyAgeYears ?? ""}
              onChange={(e) => set("propertyAgeYears", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Covered area" error={errors.coveredArea}>
            <input
              type="number"
              min="0"
              value={values.coveredArea ?? ""}
              onChange={(e) => set("coveredArea", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Plot size" error={errors.plotSize}>
            <input
              type="number"
              min="0"
              value={values.plotSize ?? ""}
              onChange={(e) => set("plotSize", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Unit" error={errors.areaUnit}>
            <select
              value={values.areaUnit ?? ""}
              onChange={(e) => set("areaUnit", e.target.value)}
              disabled={submitting}
            >
              <option value="">Select…</option>
              {AREA_UNITS.map((u) => (
                <option key={u} value={u}>
                  {formatLabel(u)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Floor number" error={errors.floorNumber}>
            <input
              type="number"
              value={values.floorNumber ?? ""}
              onChange={(e) => set("floorNumber", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Total floors" error={errors.totalFloors}>
            <input
              type="number"
              min="0"
              value={values.totalFloors ?? ""}
              onChange={(e) => set("totalFloors", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="Facing" error={errors.facingDirection}>
            <select
              value={values.facingDirection ?? ""}
              onChange={(e) => set("facingDirection", e.target.value)}
              disabled={submitting}
            >
              <option value="">Select…</option>
              {FACING_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Furnishing" error={errors.furnishingStatus}>
            <select
              value={values.furnishingStatus ?? ""}
              onChange={(e) => set("furnishingStatus", e.target.value)}
              disabled={submitting}
            >
              <option value="">Select…</option>
              {FURNISHING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Possession" error={errors.possessionStatus}>
            <select
              value={values.possessionStatus ?? ""}
              onChange={(e) => set("possessionStatus", e.target.value)}
              disabled={submitting}
            >
              <option value="">Select…</option>
              {POSSESSION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Property features</h3>
        <div className="feature-check-grid">
          {FEATURE_FLAGS.map(({ key, label }) => (
            <label key={key} className="checkbox-inline feature-check">
              <input
                type="checkbox"
                checked={Boolean(features[key])}
                onChange={(e) => setFeature(key, e.target.checked)}
                disabled={submitting}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="form-grid" style={{ marginTop: "1rem" }}>
          <Field label="Parking capacity" error={errors.parkingCapacity}>
            <input
              type="number"
              min="0"
              step="1"
              value={features.parkingCapacity ?? ""}
              onChange={(e) => setFeature("parkingCapacity", e.target.value)}
              disabled={submitting || !features.parking}
              placeholder="Number of vehicles"
            />
          </Field>
          <Field label="Lift" error={errors.liftCount}>
            <select
              value={features.liftCount ?? ""}
              onChange={(e) => setFeature("liftCount", e.target.value)}
              disabled={submitting}
            >
              <option value="">None</option>
              {COUNT_1_TO_3.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cargo" error={errors.cargoCount}>
            <select
              value={features.cargoCount ?? ""}
              onChange={(e) => setFeature("cargoCount", e.target.value)}
              disabled={submitting}
            >
              <option value="">None</option>
              {COUNT_1_TO_3.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Water supply" error={errors.waterSupply}>
            <select
              value={features.waterSupply ?? ""}
              onChange={(e) => setFeature("waterSupply", e.target.value)}
              disabled={submitting}
            >
              <option value="">Select…</option>
              {WATER_SUPPLY_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {features.waterSupply &&
              !WATER_SUPPLY_OPTIONS.includes(features.waterSupply) ? (
                <option value={features.waterSupply}>
                  {features.waterSupply}
                </option>
              ) : null}
            </select>
          </Field>
          <Field label="Appliances" error={errors.appliances}>
            <input
              value={features.appliances ?? ""}
              onChange={(e) => setFeature("appliances", e.target.value)}
              disabled={submitting}
              placeholder="e.g. Fridge, AC, Oven"
            />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Ownership & legal</h3>
        <div className="form-grid">
          <Field label="Ownership type" error={errors.ownershipType}>
            <select
              value={values.ownershipType ?? ""}
              onChange={(e) => set("ownershipType", e.target.value)}
              disabled={submitting}
            >
              <option value="">Select…</option>
              {OWNERSHIP_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Legal status" error={errors.legalStatus}>
            <select
              value={values.legalStatus ?? ""}
              onChange={(e) => set("legalStatus", e.target.value)}
              disabled={submitting}
            >
              <option value="">Select…</option>
              {LEGAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="NOC status" error={errors.nocStatus}>
            <select
              value={values.nocStatus ?? ""}
              onChange={(e) => set("nocStatus", e.target.value)}
              disabled={submitting}
            >
              <option value="">Select…</option>
              {NOC_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Utilities</h3>
        <div className="form-grid">
          <Field
            label="Electricity meter"
            error={errors.utilityMeterElectricity}
          >
            <input
              value={values.utilityMeterElectricity ?? ""}
              onChange={(e) => set("utilityMeterElectricity", e.target.value)}
              disabled={submitting}
              placeholder="Meter / connection no."
            />
          </Field>
          <Field label="Gas meter" error={errors.utilityMeterGas}>
            <input
              value={values.utilityMeterGas ?? ""}
              onChange={(e) => set("utilityMeterGas", e.target.value)}
              disabled={submitting}
              placeholder="Meter / connection no."
            />
          </Field>
          <Field label="Water meter" error={errors.utilityMeterWater}>
            <input
              value={values.utilityMeterWater ?? ""}
              onChange={(e) => set("utilityMeterWater", e.target.value)}
              disabled={submitting}
              placeholder="Meter / connection no."
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
        <button type="submit" className="btn btn--primary btn--inline" disabled={submitting}>
          {submitting
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create property"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
