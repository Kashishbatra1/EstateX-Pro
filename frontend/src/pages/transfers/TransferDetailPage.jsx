import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getTransfer, deleteTransfer } from "../../api/transfers.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  formatApiError,
  formatLabel,
  totalCharges,
} from "../../utils/transferHelpers.js";
import "../../styles/properties.css";

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>
        {value === null || value === undefined || value === "" ? "—" : value}
      </dd>
    </div>
  );
}

export default function TransferDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [actionError, setActionError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getTransfer(id);
      setTransfer(data);
    } catch (err) {
      setTransfer(null);
      setError(
        err instanceof ApiError
          ? formatApiError(err)
          : "Failed to load transfer"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(""), 3200);
    return () => clearTimeout(t);
  }, [flash]);

  async function handleDelete() {
    setBusy(true);
    setActionError("");
    try {
      await deleteTransfer(id);
      navigate("/transfers", {
        replace: true,
        state: { flash: "Transfer moved to recycle bin" },
      });
    } catch (err) {
      setActionError(
        err instanceof ApiError ? formatApiError(err) : "Archive failed"
      );
      setDeleteOpen(false);
    } finally {
      setBusy(false);
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

  if (error || !transfer) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{error || "Transfer not found"}</p>
        <Link to="/transfers" className="btn btn--ghost">
          Back to list
        </Link>
      </div>
    );
  }

  const snapshotOwners = transfer.previousOwnerSnapshot?.owners || [];

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/transfers" className="crumb">
              Transfers
            </Link>
            <span aria-hidden="true"> / </span>
            #{transfer.id}
          </p>
          <h2 className="page-toolbar__title">
            {formatLabel(transfer.transferType)} ·{" "}
            {transfer.propertyCode || `Property #${transfer.propertyId}`}
          </h2>
          <div className="detail-meta">
            <StatusBadge status={transfer.transferType} />
            <span className="muted">{transfer.transferDate || "—"}</span>
          </div>
        </div>
        <div className="toolbar-actions">
          <Link
            to={`/transfers/${transfer.id}/edit`}
            className="btn btn--ghost"
          >
            Edit
          </Link>
          <button
            type="button"
            className="btn btn--danger-outline"
            onClick={() => setDeleteOpen(true)}
          >
            Archive
          </button>
        </div>
      </div>

      {flash ? <div className="toast toast--success">{flash}</div> : null}
      {actionError ? (
        <div className="alert alert--error" role="alert">
          {actionError}
        </div>
      ) : null}

      <div className="finance-cards">
        <div className="finance-card">
          <div className="finance-card__label">Transfer charges</div>
          <div className="finance-card__value">
            {formatMoney(transfer.transferCharges)}
          </div>
        </div>
        <div className="finance-card">
          <div className="finance-card__label">Transfer tax</div>
          <div className="finance-card__value">
            {formatMoney(transfer.transferTax)}
          </div>
        </div>
        <div className="finance-card">
          <div className="finance-card__label">Stamp duty</div>
          <div className="finance-card__value">
            {formatMoney(transfer.stampDuty)}
          </div>
        </div>
        <div className="finance-card finance-card--accent">
          <div className="finance-card__label">Total charges</div>
          <div className="finance-card__value">
            {formatMoney(totalCharges(transfer))}
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-card">
            <h3 className="detail-card__title">Property & parties</h3>
            <dl className="detail-list">
              <DetailRow
                label="Property"
                value={
                  <Link
                    to={`/properties/${transfer.propertyId}`}
                    className="linkish"
                  >
                    {transfer.propertyCode || `#${transfer.propertyId}`}
                    {transfer.propertyTitle
                      ? ` — ${transfer.propertyTitle}`
                      : ""}
                  </Link>
                }
              />
              <DetailRow
                label="Type"
                value={<StatusBadge status={transfer.transferType} />}
              />
              <DetailRow label="Transfer date" value={transfer.transferDate} />
              <DetailRow
                label="From owner"
                value={
                  transfer.fromOwnerId ? (
                    <Link
                      to={`/owners/${transfer.fromOwnerId}`}
                      className="linkish"
                    >
                      {transfer.fromOwnerName ||
                        `Owner #${transfer.fromOwnerId}`}
                    </Link>
                  ) : null
                }
              />
              <DetailRow
                label="To owner"
                value={
                  transfer.toOwnerId ? (
                    <Link
                      to={`/owners/${transfer.toOwnerId}`}
                      className="linkish"
                    >
                      {transfer.toOwnerName || `Owner #${transfer.toOwnerId}`}
                    </Link>
                  ) : null
                }
              />
              <DetailRow
                label="From client"
                value={
                  transfer.fromClientId ? (
                    <Link
                      to={`/clients/${transfer.fromClientId}`}
                      className="linkish"
                    >
                      {transfer.fromClientName ||
                        `Client #${transfer.fromClientId}`}
                    </Link>
                  ) : null
                }
              />
              <DetailRow
                label="To client"
                value={
                  transfer.toClientId ? (
                    <Link
                      to={`/clients/${transfer.toClientId}`}
                      className="linkish"
                    >
                      {transfer.toClientName ||
                        `Client #${transfer.toClientId}`}
                    </Link>
                  ) : null
                }
              />
            </dl>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Charge breakdown</h3>
            <dl className="detail-list">
              <DetailRow
                label="Transfer charges"
                value={formatMoney(transfer.transferCharges)}
              />
              <DetailRow
                label="Lease charges"
                value={formatMoney(transfer.leaseCharges)}
              />
              <DetailRow
                label="Transfer tax"
                value={formatMoney(transfer.transferTax)}
              />
              <DetailRow
                label="Stamp duty"
                value={formatMoney(transfer.stampDuty)}
              />
              <DetailRow
                label="Total"
                value={formatMoney(totalCharges(transfer))}
              />
            </dl>
          </section>

          <section className="detail-card detail-card--muted">
            <h3 className="detail-card__title">
              Previous owner snapshot (historical)
            </h3>
            <p className="muted tiny">
              Captured at transfer creation. This is not live ownership data.
              {transfer.previousOwnerSnapshot?.capturedAt
                ? ` Snapshot time: ${new Date(
                    transfer.previousOwnerSnapshot.capturedAt
                  ).toLocaleString()}`
                : ""}
            </p>
            {snapshotOwners.length === 0 ? (
              <p className="muted">No owners in snapshot.</p>
            ) : (
              <ul className="simple-list">
                {snapshotOwners.map((o) => (
                  <li key={`${o.ownerId}-${o.propertyOwnerId}`}>
                    <strong>{o.ownerName || `Owner #${o.ownerId}`}</strong>
                    <span className="muted">
                      {" "}
                      · {o.sharePercentage}%
                      {o.isPrimary ? " · Primary" : ""}
                      {o.verificationStatus
                        ? ` · ${formatLabel(o.verificationStatus)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="detail-side">
          <section className="detail-card">
            <h3 className="detail-card__title">NOC & metadata</h3>
            <dl className="detail-list">
              <DetailRow
                label="NOC for transfer"
                value={transfer.nocForTransfer ? "Yes" : "No"}
              />
              <DetailRow label="NOC status" value={transfer.nocStatus} />
              <DetailRow
                label="NOC document path"
                value={transfer.nocDocumentPath}
              />
              <DetailRow label="Notes" value={transfer.notes} />
              <DetailRow
                label="Created"
                value={
                  transfer.createdAt
                    ? new Date(transfer.createdAt).toLocaleString()
                    : null
                }
              />
              <DetailRow
                label="Updated"
                value={
                  transfer.updatedAt
                    ? new Date(transfer.updatedAt).toLocaleString()
                    : null
                }
              />
            </dl>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Quick links</h3>
            <div className="toolbar-actions" style={{ flexWrap: "wrap" }}>
              <Link
                to={`/properties/${transfer.propertyId}`}
                className="btn btn--ghost btn--inline"
              >
                Property
              </Link>
              <Link
                to={`/transfers?propertyId=${transfer.propertyId}`}
                className="btn btn--ghost btn--inline"
              >
                Same property
              </Link>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Archive transfer?"
        message="This transfer will be soft-deleted. The previous-owner snapshot and history remain stored."
        confirmLabel="Archive"
        danger
        loading={busy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
