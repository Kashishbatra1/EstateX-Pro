import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getTransfer, updateTransfer } from "../../api/transfers.js";
import { listOwners } from "../../api/owners.js";
import { listClients } from "../../api/clients.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import {
  TRANSFER_TYPES,
  transferToEditForm,
  buildUpdatePayload,
  validateTransferForm,
  mapApiFieldErrors,
  formatApiError,
  formatLabel,
} from "../../utils/transferHelpers.js";
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

export default function TransferEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [transfer, setTransfer] = useState(null);
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [owners, setOwners] = useState([]);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFormError("");
      try {
        const [data, ownersRes, clientsRes] = await Promise.all([
          getTransfer(id),
          listOwners({ limit: 100 }),
          listClients({ limit: 100 }),
        ]);
        if (cancelled) return;
        setTransfer(data);
        setValues(transferToEditForm(data));
        setOwners(ownersRes.items || []);
        setClients(clientsRes.items || []);
      } catch (err) {
        if (!cancelled) {
          setTransfer(null);
          setValues(null);
          setFormError(
            err instanceof ApiError
              ? formatApiError(err)
              : "Failed to load transfer"
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

  function set(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!values) return;
    setFormError("");
    const clientErrors = validateTransferForm(values, {
      requireProperty: false,
    });
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const updated = await updateTransfer(id, buildUpdatePayload(values));
      navigate(`/transfers/${updated.id}`, {
        replace: true,
        state: { flash: "Transfer updated" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(formatApiError(err));
      } else {
        setFormError("Could not update transfer");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="state-panel">
        <div className="spinner" aria-hidden="true" />
        <p>Loading transfer…</p>
      </div>
    );
  }

  if (!transfer || !values) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{formError || "Transfer not found"}</p>
        <Link to="/transfers" className="btn btn--ghost">
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
            <Link to="/transfers" className="crumb">
              Transfers
            </Link>
            <span aria-hidden="true"> / </span>
            <Link to={`/transfers/${id}`} className="crumb">
              #{id}
            </Link>
            <span aria-hidden="true"> / </span>
            Edit
          </p>
          <h2 className="page-toolbar__title">Edit Transfer</h2>
          <div className="detail-meta">
            <StatusBadge status={transfer.transferType} />
            <span className="muted">
              {transfer.propertyCode || `Property #${transfer.propertyId}`}
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
            Property and previous-owner snapshot cannot be changed. Archive and
            recreate if the property link is wrong.
          </p>
          <dl className="detail-list">
            <div className="detail-row">
              <dt>Property</dt>
              <dd>
                <Link
                  to={`/properties/${transfer.propertyId}`}
                  className="linkish"
                >
                  {transfer.propertyCode || `#${transfer.propertyId}`}
                </Link>
              </dd>
            </div>
          </dl>
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Type & date</h3>
          <div className="form-grid">
            <Field label="Transfer type *" error={errors.transferType}>
              <select
                value={values.transferType}
                onChange={(e) => set("transferType", e.target.value)}
                disabled={submitting}
              >
                {TRANSFER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {formatLabel(t)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Transfer date" error={errors.transferDate}>
              <input
                type="date"
                value={values.transferDate}
                onChange={(e) => set("transferDate", e.target.value)}
                disabled={submitting}
              />
            </Field>
          </div>
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Parties</h3>
          <div className="form-grid">
            <Field label="From owner" error={errors.fromOwnerId}>
              <select
                value={values.fromOwnerId}
                onChange={(e) => set("fromOwnerId", e.target.value)}
                disabled={submitting}
              >
                <option value="">None</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.ownerName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="To owner" error={errors.toOwnerId}>
              <select
                value={values.toOwnerId}
                onChange={(e) => set("toOwnerId", e.target.value)}
                disabled={submitting}
              >
                <option value="">None</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.ownerName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From client" error={errors.fromClientId}>
              <select
                value={values.fromClientId}
                onChange={(e) => set("fromClientId", e.target.value)}
                disabled={submitting}
              >
                <option value="">None</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.clientName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="To client" error={errors.toClientId}>
              <select
                value={values.toClientId}
                onChange={(e) => set("toClientId", e.target.value)}
                disabled={submitting}
              >
                <option value="">None</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.clientName}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Charges</h3>
          <div className="form-grid">
            <Field label="Transfer charges" error={errors.transferCharges}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.transferCharges}
                onChange={(e) => set("transferCharges", e.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="Lease charges" error={errors.leaseCharges}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.leaseCharges}
                onChange={(e) => set("leaseCharges", e.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="Transfer tax" error={errors.transferTax}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.transferTax}
                onChange={(e) => set("transferTax", e.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="Stamp duty" error={errors.stampDuty}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.stampDuty}
                onChange={(e) => set("stampDuty", e.target.value)}
                disabled={submitting}
              />
            </Field>
          </div>
        </section>

        <section className="form-section">
          <h3 className="form-section__title">NOC & notes</h3>
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={values.nocForTransfer}
              onChange={(e) => set("nocForTransfer", e.target.checked)}
              disabled={submitting}
            />
            NOC required for transfer
          </label>
          <div className="form-grid" style={{ marginTop: "0.75rem" }}>
            <Field label="NOC status" error={errors.nocStatus}>
              <input
                type="text"
                value={values.nocStatus}
                onChange={(e) => set("nocStatus", e.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field
              label="NOC document path (metadata)"
              error={errors.nocDocumentPath}
            >
              <input
                type="text"
                value={values.nocDocumentPath}
                onChange={(e) => set("nocDocumentPath", e.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="Notes" error={errors.notes}>
              <textarea
                rows={3}
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
            onClick={() => navigate(`/transfers/${id}`)}
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
