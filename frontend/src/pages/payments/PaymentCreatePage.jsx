import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createPayment } from "../../api/payments.js";
import { listBookings, getBooking } from "../../api/bookings.js";
import { listPaymentMethods } from "../../api/properties.js";
import { listBankAccounts } from "../../api/banks.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  emptyPaymentCreateForm,
  buildCreatePayload,
  validateCreateForm,
  mapApiFieldErrors,
  formatApiError,
  installmentRemaining,
  formatLabel,
  roundMoney,
} from "../../utils/paymentHelpers.js";
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

export default function PaymentCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetBookingId = searchParams.get("bookingId") || "";

  const [values, setValues] = useState(() => ({
    ...emptyPaymentCreateForm(),
    bookingId: presetBookingId,
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [bookings, setBookings] = useState([]);
  const [methods, setMethods] = useState([]);
  const [banks, setBanks] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      setOptionsLoading(true);
      try {
        const [pending, confirmed, methodsRes, banksRes] = await Promise.all([
          listBookings({ status: "pending", limit: 100 }),
          listBookings({ status: "confirmed", limit: 100 }),
          listPaymentMethods(),
          listBankAccounts({ isActive: "true", limit: 100 }),
        ]);
        if (cancelled) return;
        const merged = [...(pending.items || []), ...(confirmed.items || [])];
        const byId = new Map();
        merged.forEach((b) => byId.set(b.id, b));
        setBookings(Array.from(byId.values()));
        setMethods((methodsRes || []).filter((m) => m.isActive !== false));
        setBanks(banksRes.items || []);
      } catch {
        if (!cancelled) {
          setFormError("Failed to load payment options");
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

  useEffect(() => {
    const bookingId = values.bookingId;
    if (!bookingId) {
      setSelectedBooking(null);
      return undefined;
    }
    let cancelled = false;
    setBookingLoading(true);
    getBooking(bookingId)
      .then((booking) => {
        if (!cancelled) setSelectedBooking(booking);
      })
      .catch((err) => {
        if (!cancelled) {
          setSelectedBooking(null);
          setFormError(
            err instanceof ApiError
              ? formatApiError(err)
              : "Failed to load booking details"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setBookingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [values.bookingId]);

  const installments = selectedBooking?.installments || [];
  const selectedInstallment = useMemo(() => {
    if (!values.installmentId) return null;
    return (
      installments.find((i) => String(i.id) === String(values.installmentId)) ||
      null
    );
  }, [installments, values.installmentId]);

  const bookingRemaining =
    selectedBooking?.remainingBalance != null
      ? roundMoney(selectedBooking.remainingBalance)
      : null;

  function set(field, value) {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "bookingId") next.installmentId = "";
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const clientErrors = validateCreateForm(values, {
      bookingRemaining,
      installment: selectedInstallment,
    });
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const payment = await createPayment(buildCreatePayload(values));
      navigate(`/payments/${payment.id}`, {
        replace: true,
        state: { flash: "Payment recorded" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(formatApiError(err));
        if (values.bookingId) {
          try {
            const refreshed = await getBooking(values.bookingId);
            setSelectedBooking(refreshed);
          } catch {
            /* ignore refresh failure */
          }
        }
      } else {
        setFormError("Could not record payment");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Payments</p>
          <h2 className="page-toolbar__title">Add Payment</h2>
        </div>
      </div>

      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}

      <form className="property-form" onSubmit={handleSubmit} noValidate>
        <section className="form-section">
          <h3 className="form-section__title">Booking</h3>
          <p className="form-hint">
            Only <strong>pending</strong> and <strong>confirmed</strong>{" "}
            bookings accept payments.
          </p>
          <Field label="Booking *" error={errors.bookingId}>
            <select
              value={values.bookingId}
              onChange={(e) => set("bookingId", e.target.value)}
              disabled={submitting || optionsLoading}
            >
              <option value="">Select booking…</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bookingCode} — {b.clientName || "Client"} (
                  {formatLabel(b.status)}) · rem{" "}
                  {formatMoney(b.remainingBalance)}
                </option>
              ))}
            </select>
          </Field>

          {bookingLoading ? (
            <p className="muted">Loading booking financials…</p>
          ) : null}

          {selectedBooking ? (
            <div className="finance-cards">
              <article className="finance-card">
                <p className="finance-card__label">Total price</p>
                <p className="finance-card__value">
                  {formatMoney(selectedBooking.totalPrice)}
                </p>
              </article>
              <article className="finance-card">
                <p className="finance-card__label">Down payment</p>
                <p className="finance-card__value">
                  {formatMoney(selectedBooking.bookingAmount)}
                </p>
              </article>
              <article className="finance-card finance-card--accent">
                <p className="finance-card__label">Remaining (backend)</p>
                <p className="finance-card__value">
                  {formatMoney(selectedBooking.remainingBalance)}
                </p>
              </article>
              <article className="finance-card">
                <p className="finance-card__label">Booking status</p>
                <p className="finance-card__value">
                  <StatusBadge status={selectedBooking.status} />
                </p>
              </article>
            </div>
          ) : null}
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Installment (optional)</h3>
          <Field label="Installment" error={errors.installmentId}>
            <select
              value={values.installmentId}
              onChange={(e) => set("installmentId", e.target.value)}
              disabled={submitting || !selectedBooking}
            >
              <option value="">No installment (general payment)</option>
              {installments.map((i) => {
                const rem = installmentRemaining(i);
                return (
                  <option key={i.id} value={i.id}>
                    #{i.installmentNumber} · due{" "}
                    {i.dueDate ? String(i.dueDate).slice(0, 10) : "—"} · rem{" "}
                    {formatMoney(rem)} · {formatLabel(i.status)}
                  </option>
                );
              })}
            </select>
          </Field>
          {selectedInstallment ? (
            <div className="finance-cards">
              <article className="finance-card">
                <p className="finance-card__label">Amount due</p>
                <p className="finance-card__value">
                  {formatMoney(selectedInstallment.amountDue)}
                </p>
              </article>
              <article className="finance-card">
                <p className="finance-card__label">Amount paid</p>
                <p className="finance-card__value">
                  {formatMoney(selectedInstallment.amountPaid)}
                </p>
              </article>
              <article className="finance-card finance-card--accent">
                <p className="finance-card__label">Installment remaining</p>
                <p className="finance-card__value">
                  {formatMoney(installmentRemaining(selectedInstallment))}
                </p>
              </article>
            </div>
          ) : null}
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Payment details</h3>
          <div className="form-grid">
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
            <Field label="Payment date" error={errors.paymentDate}>
              <input
                type="date"
                value={values.paymentDate}
                onChange={(e) => set("paymentDate", e.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="Payment method *" error={errors.paymentMethodId}>
              <select
                value={values.paymentMethodId}
                onChange={(e) => set("paymentMethodId", e.target.value)}
                disabled={submitting || optionsLoading}
              >
                <option value="">Select method…</option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.methodName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bank account (optional)" error={errors.bankAccountId}>
              <select
                value={values.bankAccountId}
                onChange={(e) => set("bankAccountId", e.target.value)}
                disabled={submitting || optionsLoading}
              >
                <option value="">None</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} — {b.accountHolderName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reference number" error={errors.referenceNumber}>
              <input
                value={values.referenceNumber}
                onChange={(e) => set("referenceNumber", e.target.value)}
                disabled={submitting}
              />
            </Field>
          </div>
          <Field label="Notes" error={errors.notes}>
            <textarea
              rows={3}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              disabled={submitting}
            />
          </Field>
          <p className="form-hint">
            Remaining balances shown above come from the backend. Backend
            validation is final if concurrent payments change remaining.
          </p>
        </section>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate("/payments")}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary btn--inline"
            disabled={submitting || optionsLoading}
          >
            {submitting ? "Recording…" : "Record payment"}
          </button>
        </div>
      </form>

      {selectedBooking ? (
        <p className="form-hint">
          <Link to={`/bookings/${selectedBooking.id}`}>Open booking detail</Link>
        </p>
      ) : null}
    </div>
  );
}
