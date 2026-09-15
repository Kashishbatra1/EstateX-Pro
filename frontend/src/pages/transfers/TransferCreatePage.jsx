import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createTransfer } from "../../api/transfers.js";
import { listProperties } from "../../api/properties.js";
import { listOwners } from "../../api/owners.js";
import { listClients } from "../../api/clients.js";
import { ApiError } from "../../api/client.js";
import {
  TRANSFER_TYPES,
  emptyTransferCreateForm,
  buildCreatePayload,
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

export default function TransferCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetPropertyId = searchParams.get("propertyId") || "";

  const [values, setValues] = useState(() => ({
    ...emptyTransferCreateForm(),
    propertyId: presetPropertyId,
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [properties, setProperties] = useState([]);
  const [owners, setOwners] = useState([]);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      setOptionsLoading(true);
      try {
        const [propsRes, ownersRes, clientsRes] = await Promise.all([
          listProperties({ limit: 100 }),
          listOwners({ limit: 100 }),
          listClients({ limit: 100 }),
        ]);
        if (cancelled) return;
        setProperties(propsRes.items || []);
        setOwners(ownersRes.items || []);
        setClients(clientsRes.items || []);
      } catch {
        if (!cancelled) setFormError("Failed to load form options");
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    }
    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  function set(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const clientErrors = validateTransferForm(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const transfer = await createTransfer(buildCreatePayload(values));
      navigate(`/transfers/${transfer.id}`, {
        replace: true,
        state: { flash: "Transfer recorded" },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mapApiFieldErrors(err.details));
        setFormError(formatApiError(err));
      } else {
        setFormError("Could not create transfer");
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
            <Link to="/transfers" className="crumb">
              Transfers
            </Link>
            <span aria-hidden="true"> / </span>
            New
          </p>
          <h2 className="page-toolbar__title">Record Transfer</h2>
        </div>
      </div>

      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}

      <form className="property-form" onSubmit={handleSubmit} noValidate>
        <section className="form-section">
          <h3 className="form-section__title">Property & type</h3>
          <p className="form-hint">
            Current owners are snapshotted automatically at save time. If the
            property has no linked owners, an empty historical snapshot is
            stored.
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
                disabled={submitting || optionsLoading}
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
                disabled={submitting || optionsLoading}
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
                disabled={submitting || optionsLoading}
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
                disabled={submitting || optionsLoading}
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
                placeholder="e.g. pending, approved"
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
                placeholder="Path or reference only — no file upload"
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
            onClick={() => navigate("/transfers")}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || optionsLoading}
          >
            {submitting ? "Saving…" : "Record transfer"}
          </button>
        </div>
      </form>
    </div>
  );
}
