import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getCommission, updateCommission } from "../../api/commissions.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  COMMISSION_PAYMENT_STATUSES,
  commissionToEditForm,
  buildUpdatePayload,
  validateEditForm,
  mapApiFieldErrors,
  formatApiError,
  formatLabel,
  previewCalculatedCommission,
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

export default function CommissionEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [commission, setCommission] = useState(null);
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFormError("");
      try {
        const data = await getCommission(id);
        if (cancelled) return;
        setCommission(data);
        setValues(commissionToEditForm(data));
      } catch (err) {
        if (!cancelled) {
          setCommission(null);
          setValues(null);
          setFormError(
            err instanceof ApiError
              ? formatApiError(err)
              : "Failed to load commission"
          );
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

  const previewCalc = useMemo(() => {
    if (!commission || !values) return null;
    return previewCalculatedCommission(
      commission.baseAmount,
      values.commissionPercentage
    );
  }, [commission, values]);

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
      const updated = await updateCommission(id, buildUpdatePayload(values));
      navigate(`/commissions/${updated.id}`, {
        replace: true,
        state: {
          flash: values.isManualOverride
            ? "Commission updated with manual override"
            : "Commission updated",
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(formatApiError(err));
      } else {
        setFormError("Could not update commission");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="state-panel">
        <div className="spinner" aria-hidden="true" />
        <p>Loading commission…</p>
      </div>
    );
  }

  if (!commission || !values) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{formError || "Commission not found"}</p>
        <Link to="/commissions" className="btn btn--ghost">
          Back to list
        </Link>
      </div>
    );
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
            <Link to={`/commissions/${id}`} className="crumb">
              #{id}
            </Link>
            <span aria-hidden="true"> / </span>
            Edit
          </p>
          <h2 className="page-toolbar__title">Edit Commission</h2>
          <div className="detail-meta">
            <StatusBadge status={commission.paymentStatus} />
            <span className="muted">
              {commission.propertyCode || `Property #${commission.propertyId}`}
              {commission.bookingCode ? ` · ${commission.bookingCode}` : ""}
            </span>
          </div>
        </div>
      </div>

      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}

      <form className="property-form" onSubmit={handleSubmit} noValidate>
        <section className="form-section">
          <h3 className="form-section__title">Locked context</h3>
          <p className="form-hint">
            Property and booking cannot be changed after creation. Archive and
            recreate if the transaction link is wrong.
          </p>
          <dl className="detail-list">
            <div className="detail-row">
              <dt>Property</dt>
              <dd>
                <Link
                  to={`/properties/${commission.propertyId}`}
                  className="linkish"
                >
                  {commission.propertyCode || `#${commission.propertyId}`}
                </Link>
              </dd>
            </div>
            <div className="detail-row">
              <dt>Booking</dt>
              <dd>
                {commission.bookingId ? (
                  <Link
                    to={`/bookings/${commission.bookingId}`}
                    className="linkish"
                  >
                    {commission.bookingCode || `#${commission.bookingId}`}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="detail-row">
              <dt>Base amount</dt>
              <dd>{formatMoney(commission.baseAmount)}</dd>
            </div>
          </dl>
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
            <p className="commission-preview__title">Recalculation preview</p>
            <div className="commission-breakdown">
              <div className="commission-breakdown__row">
                <span className="commission-breakdown__label">
                  Current calculated (server)
                </span>
                <span className="commission-breakdown__value">
                  {formatMoney(commission.calculatedAmount)}
                </span>
              </div>
              <div className="commission-breakdown__row">
                <span className="commission-breakdown__label">
                  Preview with new %
                </span>
                <span className="commission-breakdown__value">
                  {previewCalc != null ? formatMoney(previewCalc) : "—"}
                </span>
              </div>
            </div>
            <p className="commission-preview__note">
              Saving recalculates on the server. Manual override keeps
              calculated amount for audit while storing your final amount.
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
                />
              </Field>
            </div>
          ) : (
            <p className="form-hint">
              Clearing override sets final amount back to the recalculated
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
              />
            </Field>
          </div>
        </section>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate(`/commissions/${id}`)}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
