import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createBooking } from "../../api/bookings.js";
import { listProperties } from "../../api/properties.js";
import { listClients } from "../../api/clients.js";
import { ApiError } from "../../api/client.js";
import { formatMoney } from "../../utils/format.js";
import {
  emptyBookingCreateForm,
  buildCreatePayload,
  validateCreateForm,
  mapApiFieldErrors,
  formatApiError,
  remainingPreview,
  formatLabel,
} from "../../utils/bookingHelpers.js";
import "../../styles/properties.css";

function Field({ label, error, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

export default function BookingCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState(() => {
    const form = emptyBookingCreateForm();
    const propertyId = searchParams.get("propertyId");
    if (propertyId) form.propertyId = propertyId;
    return form;
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [properties, setProperties] = useState([]);
  const [clients, setClients] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      setOptionsLoading(true);
      try {
        const [propsRes, clientsRes] = await Promise.all([
          listProperties({ status: "available", limit: 100 }),
          listClients({ limit: 100 }),
        ]);
        if (cancelled) return;
        setProperties(propsRes.items || []);
        setClients(clientsRes.items || []);
      } catch {
        if (!cancelled) {
          setProperties([]);
          setClients([]);
          setFormError("Failed to load properties or clients");
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    }
    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const remaining = useMemo(
    () => remainingPreview(values.totalPrice, values.bookingAmount),
    [values.totalPrice, values.bookingAmount]
  );

  function set(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const clientErrors = validateCreateForm(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const booking = await createBooking(buildCreatePayload(values));
      navigate(`/bookings/${booking.id}`, {
        replace: true,
        state: { flash: "Booking created as pending" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(formatApiError(err));
      } else {
        setFormError("Could not create booking");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Bookings</p>
          <h2 className="page-toolbar__title">Add Booking</h2>
        </div>
      </div>

      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}

      <form className="property-form" onSubmit={handleSubmit} noValidate>
        <section className="form-section">
          <h3 className="form-section__title">Parties</h3>
          <p className="form-hint">
            Only <strong>available</strong> properties are listed. Backend
            rejects draft, reserved, sold, and rented properties.
          </p>
          <div className="form-grid">
            <Field label="Property *" error={errors.propertyId}>
              <select
                value={values.propertyId}
                onChange={(e) => set("propertyId", e.target.value)}
                disabled={submitting || optionsLoading}
              >
                <option value="">Select available property…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.propertyCode || `#${p.id}`} — {p.title} (
                    {formatLabel(p.purpose)})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Client *" error={errors.clientId}>
              <select
                value={values.clientId}
                onChange={(e) => set("clientId", e.target.value)}
                disabled={submitting || optionsLoading}
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.clientName}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {!optionsLoading && properties.length === 0 ? (
            <p className="form-hint">
              No available properties found. Make a property available before
              booking.
            </p>
          ) : null}
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Financials</h3>
          <div className="form-grid">
            <Field label="Total price *" error={errors.totalPrice}>
              <input
                type="number"
                min="0"
                step="1"
                value={values.totalPrice}
                onChange={(e) => set("totalPrice", e.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="Down payment *" error={errors.bookingAmount}>
              <input
                type="number"
                min="0"
                step="1"
                value={values.bookingAmount}
                onChange={(e) => set("bookingAmount", e.target.value)}
                disabled={submitting}
              />
            </Field>
          </div>
          <p className="form-hint">
            Remaining balance preview:{" "}
            <strong>
              {remaining === null
                ? "—"
                : remaining < 0
                  ? "Invalid (down payment exceeds total)"
                  : formatMoney(remaining)}
            </strong>
            {" "}(backend: totalPrice − bookingAmount)
          </p>
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Optional details</h3>
          <div className="form-grid">
            <Field label="Installment plan name" error={errors.installmentPlanName}>
              <input
                value={values.installmentPlanName}
                onChange={(e) => set("installmentPlanName", e.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field
              label="Monthly installment amount"
              error={errors.monthlyInstallmentAmount}
            >
              <input
                type="number"
                min="0"
                value={values.monthlyInstallmentAmount}
                onChange={(e) =>
                  set("monthlyInstallmentAmount", e.target.value)
                }
                disabled={submitting}
              />
            </Field>
            <Field label="Token / receipt number" error={errors.tokenReceiptNumber}>
              <input
                value={values.tokenReceiptNumber}
                onChange={(e) => set("tokenReceiptNumber", e.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="Booking expiry date" error={errors.bookingExpiryDate}>
              <input
                type="date"
                value={values.bookingExpiryDate}
                onChange={(e) => set("bookingExpiryDate", e.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="Digital agreement URL" error={errors.digitalAgreementUrl}>
              <input
                value={values.digitalAgreementUrl}
                onChange={(e) => set("digitalAgreementUrl", e.target.value)}
                disabled={submitting}
              />
            </Field>
          </div>
          <p className="form-hint">
            New bookings are created as <strong>pending</strong>. Confirm,
            cancel, or complete from the booking detail page.
          </p>
        </section>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate("/bookings")}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary btn--inline"
            disabled={submitting || optionsLoading}
          >
            {submitting ? "Creating…" : "Create booking"}
          </button>
        </div>
      </form>
    </div>
  );
}
