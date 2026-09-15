import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createCommission } from "../../api/commissions.js";
import { listProperties, getProperty } from "../../api/properties.js";
import { listBookings, getBooking } from "../../api/bookings.js";
import { ApiError } from "../../api/client.js";
import { formatMoney } from "../../utils/format.js";
import {
  COMMISSION_PAYMENT_STATUSES,
  emptyCommissionCreateForm,
  buildCreatePayload,
  validateCreateForm,
  mapApiFieldErrors,
  formatApiError,
  formatLabel,
  previewCalculatedCommission,
  resolveBaseFromSources,
} from "../../utils/commissionHelpers.js";
import "../../styles/properties.css";
import "../../styles/commissions.css";

function Field({ label, error, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

export default function CommissionCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetPropertyId = searchParams.get("propertyId") || "";
  const presetBookingId = searchParams.get("bookingId") || "";

  const [values, setValues] = useState(() => ({
    ...emptyCommissionCreateForm(),
    propertyId: presetPropertyId,
    bookingId: presetBookingId,
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      setOptionsLoading(true);
      try {
        const propsRes = await listProperties({ limit: 100 });
        if (cancelled) return;
        setProperties(propsRes.items || []);
      } catch {
        if (!cancelled) setFormError("Failed to load properties");
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    }
    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const propertyId = values.propertyId;
    if (!propertyId) {
      setSelectedProperty(null);
      setBookings([]);
      return undefined;
    }
    let cancelled = false;
    Promise.all([
      getProperty(propertyId),
      listBookings({ propertyId, limit: 100 }),
    ])
      .then(([property, bookingsRes]) => {
        if (cancelled) return;
        setSelectedProperty(property);
        setBookings(bookingsRes.items || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setSelectedProperty(null);
          setBookings([]);
          setFormError(
            err instanceof ApiError
              ? formatApiError(err)
              : "Failed to load property details"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [values.propertyId]);

  useEffect(() => {
    const bookingId = values.bookingId;
    if (!bookingId) {
      setSelectedBooking(null);
      return undefined;
    }
    let cancelled = false;
    getBooking(bookingId)
      .then((booking) => {
        if (!cancelled) setSelectedBooking(booking);
      })
      .catch(() => {
        if (!cancelled) setSelectedBooking(null);
      });
    return () => {
      cancelled = true;
    };
  }, [values.bookingId]);

  const baseAmount = useMemo(
    () => resolveBaseFromSources(selectedProperty, selectedBooking),
    [selectedProperty, selectedBooking]
  );

  const previewCalc = useMemo(
    () => previewCalculatedCommission(baseAmount, values.commissionPercentage),
    [baseAmount, values.commissionPercentage]
  );

  function set(field, value) {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "propertyId") next.bookingId = "";
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const clientErrors = validateCreateForm(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const commission = await createCommission(buildCreatePayload(values));
      navigate(`/commissions/${commission.id}`, {
        replace: true,
        state: { flash: "Commission created" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(formatApiError(err));
      } else {
        setFormError("Could not create commission");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/commissions" className="crumb">
              Commissions
            </Link>
            <span aria-hidden="true"> / </span>
            New
          </p>
          <h2 className="page-toolbar__title">Add Commission</h2>
        </div>
      </div>

      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}

      <form className="property-form" onSubmit={handleSubmit} noValidate>
        <section className="form-section">
          <h3 className="form-section__title">Transaction context</h3>
          <p className="form-hint">
            Commission is calculated from the booking total when linked;
            otherwise from property asking price (sale) or monthly rent (rent).
            The server is the source of truth.
          </p>
          <div className="form-grid">
            <Field label="Property *" error={errors.propertyId}>
              <select
                value={values.propertyId}
                onChange={(e) => set("propertyId", e.target.value)}
                disabled={submitting || optionsLoading}
              >
                <option value="">Select property…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.propertyCode} — {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Booking (optional)" error={errors.bookingId}>
              <select
                value={values.bookingId}
                onChange={(e) => set("bookingId", e.target.value)}
                disabled={submitting || !values.propertyId}
              >
                <option value="">No booking — use property price</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bookingCode} — {b.clientName || "Client"} (
                    {formatMoney(b.totalPrice)})
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Commission</h3>
          <div className="form-grid">
            <Field
              label="Commission percentage"
              error={errors.commissionPercentage}
            >
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={values.commissionPercentage}
                onChange={(e) => set("commissionPercentage", e.target.value)}
                disabled={submitting}
                placeholder="e.g. 2"
              />
            </Field>
            <Field label="Payment status" error={errors.paymentStatus}>
              <select
                value={values.paymentStatus}
                onChange={(e) => set("paymentStatus", e.target.value)}
                disabled={submitting}
              >
                {COMMISSION_PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {formatLabel(s)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="commission-preview">
            <p className="commission-preview__title">Calculation preview</p>
            <div className="commission-breakdown">
              <div className="commission-breakdown__row">
                <span className="commission-breakdown__label">Base amount</span>
                <span className="commission-breakdown__value">
                  {baseAmount != null ? formatMoney(baseAmount) : "—"}
                </span>
              </div>
              <div className="commission-breakdown__row">
                <span className="commission-breakdown__label">
                  Calculated commission
                </span>
                <span className="commission-breakdown__value">
                  {previewCalc != null ? formatMoney(previewCalc) : "—"}
                </span>
              </div>
            </div>
            <p className="commission-preview__note">
              Preview only. Final figures are computed and stored by the API.
            </p>
          </div>
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Brokerage</h3>
          <div className="form-grid">
            <Field
              label="Brokerage from buyer"
              error={errors.brokerageFromBuyer}
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.brokerageFromBuyer}
                onChange={(e) => set("brokerageFromBuyer", e.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field
              label="Brokerage from seller"
              error={errors.brokerageFromSeller}
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.brokerageFromSeller}
                onChange={(e) => set("brokerageFromSeller", e.target.value)}
                disabled={submitting}
              />
            </Field>
          </div>
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Manual override</h3>
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={values.isManualOverride}
              onChange={(e) => set("isManualOverride", e.target.checked)}
              disabled={submitting}
            />
            Override final commission amount
          </label>
          {values.isManualOverride ? (
            <div className="form-grid" style={{ marginTop: "0.75rem" }}>
              <Field label="Final amount *" error={errors.finalAmount}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.finalAmount}
                  onChange={(e) => set("finalAmount", e.target.value)}
                  disabled={submitting}
                />
              </Field>
              <Field label="Override reason *" error={errors.overrideReason}>
                <input
                  type="text"
                  value={values.overrideReason}
                  onChange={(e) => set("overrideReason", e.target.value)}
                  disabled={submitting}
                  placeholder="Required when overriding"
                />
              </Field>
            </div>
          ) : (
            <p className="form-hint">
              Leave unchecked to store final amount equal to calculated
              commission.
            </p>
          )}
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Assignment</h3>
          <div className="form-grid">
            <Field
              label="Assigned agent (employees.id)"
              error={errors.assignedAgentId}
            >
              <input
                type="number"
                min="1"
                value={values.assignedAgentId}
                onChange={(e) => set("assignedAgentId", e.target.value)}
                disabled={submitting}
                placeholder="Optional"
              />
            </Field>
            <Field label="Referral source" error={errors.referralSource}>
              <input
                type="text"
                value={values.referralSource}
                onChange={(e) => set("referralSource", e.target.value)}
                disabled={submitting}
                placeholder="Optional"
              />
            </Field>
          </div>
        </section>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate("/commissions")}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || optionsLoading}
          >
            {submitting ? "Saving…" : "Create commission"}
          </button>
        </div>
      </form>
    </div>
  );
}
