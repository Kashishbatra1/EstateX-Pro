import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBooking, updateBooking } from "../../api/bookings.js";
import { ApiError } from "../../api/client.js";
import { formatMoney } from "../../utils/format.js";
import {
  bookingToEditForm,
  buildUpdatePayload,
  validateEditForm,
  mapApiFieldErrors,
  formatApiError,
  remainingPreview,
  canEditBooking,
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

export default function BookingEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bookingMeta, setBookingMeta] = useState(null);
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const booking = await getBooking(id);
        if (cancelled) return;
        if (!booking) {
          setFormError("Booking not found");
          setValues(null);
          return;
        }
        if (!canEditBooking(booking.status)) {
          setFormError(
            `Cannot edit a ${booking.status} booking. Only pending or confirmed bookings can be updated.`
          );
          setBookingMeta(booking);
          setValues(null);
          return;
        }
        setBookingMeta(booking);
        setValues(bookingToEditForm(booking));
      } catch (err) {
        if (!cancelled) {
          setFormError(
            err instanceof ApiError
              ? formatApiError(err)
              : "Failed to load booking"
          );
          setValues(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const remaining = useMemo(
    () =>
      values
        ? remainingPreview(values.totalPrice, values.bookingAmount)
        : null,
    [values]
  );

  function set(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!values) return;
    setFormError("");
    const clientErrors = validateEditForm(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const booking = await updateBooking(id, buildUpdatePayload(values));
      navigate(`/bookings/${booking.id}`, {
        replace: true,
        state: { flash: "Booking updated" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(formatApiError(err));
      } else {
        setFormError("Could not update booking");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="state-panel">
        <div className="spinner" aria-hidden="true" />
        <p>Loading booking…</p>
      </div>
    );
  }

  if (!values) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{formError || "Booking not found"}</p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() =>
            navigate(bookingMeta ? `/bookings/${id}` : "/bookings")
          }
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Bookings</p>
          <h2 className="page-toolbar__title">
            Edit {bookingMeta?.bookingCode || "Booking"}
          </h2>
        </div>
      </div>

      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}

      <form className="property-form" onSubmit={handleSubmit} noValidate>
        <section className="form-section">
          <h3 className="form-section__title">Locked parties</h3>
          <p className="form-hint">
            Property and client cannot be changed after creation. Status is
            changed from the detail page workflow actions.
          </p>
          <div className="form-grid">
            <Field label="Property">
              <input
                value={`${bookingMeta.propertyCode || ""} — ${bookingMeta.propertyTitle || ""}`}
                disabled
              />
            </Field>
            <Field label="Client">
              <input value={bookingMeta.clientName || ""} disabled />
            </Field>
          </div>
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Financials</h3>
          <div className="form-grid">
            <Field label="Total price *" error={errors.totalPrice}>
              <input
                type="number"
                min="0"
                value={values.totalPrice}
                onChange={(e) => set("totalPrice", e.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="Down payment *" error={errors.bookingAmount}>
              <input
                type="number"
                min="0"
                value={values.bookingAmount}
                onChange={(e) => set("bookingAmount", e.target.value)}
                disabled={submitting}
              />
            </Field>
          </div>
          <p className="form-hint">
            Remaining preview:{" "}
            <strong>
              {remaining === null
                ? "—"
                : remaining < 0
                  ? "Invalid"
                  : formatMoney(remaining)}
            </strong>
          </p>
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Other fields</h3>
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
        </section>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate(`/bookings/${id}`)}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary btn--inline"
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
