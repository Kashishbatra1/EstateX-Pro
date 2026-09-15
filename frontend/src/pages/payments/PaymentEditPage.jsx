import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPayment, updatePayment } from "../../api/payments.js";
import { listPaymentMethods } from "../../api/properties.js";
import { listBankAccounts } from "../../api/banks.js";
import { ApiError } from "../../api/client.js";
import { formatMoney } from "../../utils/format.js";
import {
  paymentToEditForm,
  buildUpdatePayload,
  validateEditForm,
  mapApiFieldErrors,
  formatApiError,
  roundMoney,
  installmentRemaining,
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

export default function PaymentEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [methods, setMethods] = useState([]);
  const [banks, setBanks] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [pay, methodsRes, banksRes] = await Promise.all([
          getPayment(id),
          listPaymentMethods(),
          listBankAccounts({ isActive: "true", limit: 100 }),
        ]);
        if (cancelled) return;
        if (!pay) {
          setFormError("Payment not found");
          setValues(null);
          return;
        }
        setPayment(pay);
        setValues(paymentToEditForm(pay));
        setMethods((methodsRes || []).filter((m) => m.isActive !== false));
        setBanks(banksRes.items || []);
      } catch (err) {
        if (!cancelled) {
          setFormError(
            err instanceof ApiError
              ? formatApiError(err)
              : "Failed to load payment"
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

  const maxAmount = useMemo(() => {
    if (!payment) return null;
    const remaining =
      payment.booking?.remainingBalance != null
        ? Number(payment.booking.remainingBalance)
        : payment.remainingBalanceAfter != null
          ? Number(payment.remainingBalanceAfter)
          : null;
    const current = Number(payment.amount) || 0;
    if (remaining == null) return null;
    // Editing amount: current payment is already applied; capacity ≈ remaining + current
    return roundMoney(remaining + current);
  }, [payment]);

  function set(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!values) return;
    setFormError("");
    const clientErrors = validateEditForm(values, {
      maxAmount,
      installment: payment?.installment,
    });
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const updated = await updatePayment(id, buildUpdatePayload(values));
      navigate(`/payments/${updated.id}`, {
        replace: true,
        state: { flash: "Payment updated" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(formatApiError(err));
        try {
          const refreshed = await getPayment(id);
          setPayment(refreshed);
        } catch {
          /* ignore */
        }
      } else {
        setFormError("Could not update payment");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="state-panel">
        <div className="spinner" aria-hidden="true" />
        <p>Loading payment…</p>
      </div>
    );
  }

  if (!values || !payment) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{formError || "Payment not found"}</p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => navigate("/payments")}
        >
          Back to list
        </button>
      </div>
    );
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Payments</p>
          <h2 className="page-toolbar__title">
            Edit {payment.paymentCode || "Payment"}
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
          <h3 className="form-section__title">Locked links</h3>
          <p className="form-hint">
            Booking and installment cannot be reassigned. Reverse and create a
            new payment to change them.
          </p>
          <div className="form-grid">
            <Field label="Booking">
              <input
                value={payment.bookingCode || `#${payment.bookingId}`}
                disabled
              />
            </Field>
            <Field label="Installment">
              <input
                value={
                  payment.installment
                    ? `#${payment.installment.installmentNumber} (rem ${formatMoney(installmentRemaining(payment.installment))})`
                    : "None"
                }
                disabled
              />
            </Field>
          </div>
          {maxAmount != null ? (
            <p className="form-hint">
              Approximate max amount (remaining + current payment):{" "}
              <strong>{formatMoney(maxAmount)}</strong>. Backend is final.
            </p>
          ) : null}
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Editable fields</h3>
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
                disabled={submitting}
              >
                <option value="">Select method…</option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.methodName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bank account" error={errors.bankAccountId}>
              <select
                value={values.bankAccountId}
                onChange={(e) => set("bankAccountId", e.target.value)}
                disabled={submitting}
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
        </section>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate(`/payments/${id}`)}
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
