import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getCommission, deleteCommission } from "../../api/commissions.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import { formatApiError } from "../../utils/commissionHelpers.js";
import "../../styles/properties.css";
import "../../styles/commissions.css";

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

export default function CommissionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [commission, setCommission] = useState(null);
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
      const data = await getCommission(id);
      setCommission(data);
    } catch (err) {
      setCommission(null);
      setError(
        err instanceof ApiError
          ? formatApiError(err)
          : "Failed to load commission"
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
      await deleteCommission(id);
      navigate("/commissions", {
        replace: true,
        state: { flash: "Commission moved to recycle bin" },
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
        <p>Loading commission…</p>
      </div>
    );
  }

  if (error || !commission) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{error || "Commission not found"}</p>
        <Link to="/commissions" className="btn btn--ghost">
          Back to list
        </Link>
      </div>
    );
  }

  const totalBrokerage =
    Number(commission.brokerageFromBuyer || 0) +
    Number(commission.brokerageFromSeller || 0);

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/commissions" className="crumb">
              Commissions
            </Link>
            <span aria-hidden="true"> / </span>
            #{commission.id}
          </p>
          <h2 className="page-toolbar__title">
            {formatMoney(commission.finalAmount)}
          </h2>
          <div className="detail-meta">
            <StatusBadge status={commission.paymentStatus} />
            {commission.isManualOverride ? (
              <span className="status-badge status-badge--partial">
                Manual override
              </span>
            ) : null}
            <span className="muted">
              {commission.propertyCode || `Property #${commission.propertyId}`}
            </span>
          </div>
        </div>
        <div className="toolbar-actions">
          <Link
            to={`/commissions/${commission.id}/edit`}
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

      {commission.isManualOverride ? (
        <div className="override-banner" role="status">
          Final commission was manually overridden
          {commission.overrideReason
            ? `: ${commission.overrideReason}`
            : "."}
        </div>
      ) : null}

      <div className="finance-cards">
        <div className="finance-card">
          <div className="finance-card__label">Base amount</div>
          <div className="finance-card__value">
            {formatMoney(commission.baseAmount)}
          </div>
        </div>
        <div className="finance-card">
          <div className="finance-card__label">Calculated</div>
          <div className="finance-card__value">
            {formatMoney(commission.calculatedAmount)}
          </div>
        </div>
        <div className="finance-card finance-card--accent">
          <div className="finance-card__label">Final commission</div>
          <div className="finance-card__value">
            {formatMoney(commission.finalAmount)}
          </div>
        </div>
        <div className="finance-card">
          <div className="finance-card__label">Total brokerage</div>
          <div className="finance-card__value">
            {formatMoney(totalBrokerage)}
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-card">
            <h3 className="detail-card__title">Transaction context</h3>
            <dl className="detail-list">
              <DetailRow
                label="Property"
                value={
                  <Link
                    to={`/properties/${commission.propertyId}`}
                    className="linkish"
                  >
                    {commission.propertyCode || `#${commission.propertyId}`}
                    {commission.propertyTitle
                      ? ` — ${commission.propertyTitle}`
                      : ""}
                  </Link>
                }
              />
              <DetailRow
                label="Property status"
                value={
                  commission.propertyStatus ? (
                    <StatusBadge status={commission.propertyStatus} />
                  ) : null
                }
              />
              <DetailRow
                label="Booking"
                value={
                  commission.bookingId ? (
                    <Link
                      to={`/bookings/${commission.bookingId}`}
                      className="linkish"
                    >
                      {commission.bookingCode || `#${commission.bookingId}`}
                    </Link>
                  ) : (
                    "Not linked"
                  )
                }
              />
              <DetailRow
                label="Booking status"
                value={
                  commission.bookingStatus ? (
                    <StatusBadge status={commission.bookingStatus} />
                  ) : null
                }
              />
              <DetailRow
                label="Client"
                value={
                  commission.clientId ? (
                    <Link
                      to={`/clients/${commission.clientId}`}
                      className="linkish"
                    >
                      {commission.clientName || `Client #${commission.clientId}`}
                    </Link>
                  ) : null
                }
              />
            </dl>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Commission breakdown</h3>
            <div className="commission-breakdown">
              <div className="commission-breakdown__row">
                <span className="commission-breakdown__label">Base amount</span>
                <span className="commission-breakdown__value">
                  {formatMoney(commission.baseAmount)}
                </span>
              </div>
              <div className="commission-breakdown__row">
                <span className="commission-breakdown__label">
                  Commission %
                </span>
                <span className="commission-breakdown__value">
                  {commission.commissionPercentage != null
                    ? `${commission.commissionPercentage}%`
                    : "—"}
                </span>
              </div>
              <div className="commission-breakdown__row">
                <span className="commission-breakdown__label">
                  Calculated commission
                </span>
                <span className="commission-breakdown__value">
                  {formatMoney(commission.calculatedAmount)}
                </span>
              </div>
              <div className="commission-breakdown__row commission-breakdown__row--emphasis">
                <span className="commission-breakdown__label">
                  Final commission
                </span>
                <span className="commission-breakdown__value">
                  {formatMoney(commission.finalAmount)}
                </span>
              </div>
            </div>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Brokerage breakdown</h3>
            <div className="commission-breakdown">
              <div className="commission-breakdown__row">
                <span className="commission-breakdown__label">
                  From buyer
                </span>
                <span className="commission-breakdown__value">
                  {formatMoney(commission.brokerageFromBuyer)}
                </span>
              </div>
              <div className="commission-breakdown__row">
                <span className="commission-breakdown__label">
                  From seller
                </span>
                <span className="commission-breakdown__value">
                  {formatMoney(commission.brokerageFromSeller)}
                </span>
              </div>
              <div className="commission-breakdown__row commission-breakdown__row--emphasis">
                <span className="commission-breakdown__label">Total</span>
                <span className="commission-breakdown__value">
                  {formatMoney(totalBrokerage)}
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="detail-side">
          <section className="detail-card">
            <h3 className="detail-card__title">Status & assignment</h3>
            <dl className="detail-list">
              <DetailRow
                label="Payment status"
                value={<StatusBadge status={commission.paymentStatus} />}
              />
              <DetailRow
                label="Manual override"
                value={commission.isManualOverride ? "Yes" : "No"}
              />
              <DetailRow
                label="Override reason"
                value={commission.overrideReason}
              />
              <DetailRow
                label="Assigned agent"
                value={
                  commission.assignedAgentName ||
                  (commission.assignedAgentId
                    ? `Employee #${commission.assignedAgentId}`
                    : null)
                }
              />
              <DetailRow
                label="Referral source"
                value={commission.referralSource}
              />
              <DetailRow
                label="Created"
                value={
                  commission.createdAt
                    ? new Date(commission.createdAt).toLocaleString()
                    : null
                }
              />
              <DetailRow
                label="Updated"
                value={
                  commission.updatedAt
                    ? new Date(commission.updatedAt).toLocaleString()
                    : null
                }
              />
            </dl>
          </section>

          <section className="detail-card detail-card--muted">
            <h3 className="detail-card__title">Quick links</h3>
            <div className="toolbar-actions" style={{ flexWrap: "wrap" }}>
              <Link
                to={`/properties/${commission.propertyId}`}
                className="btn btn--ghost btn--inline"
              >
                Property
              </Link>
              {commission.bookingId ? (
                <Link
                  to={`/bookings/${commission.bookingId}`}
                  className="btn btn--ghost btn--inline"
                >
                  Booking
                </Link>
              ) : null}
              <Link
                to={`/commissions?propertyId=${commission.propertyId}`}
                className="btn btn--ghost btn--inline"
              >
                Same property
              </Link>
            </div>
            <p className="muted tiny" style={{ marginTop: "0.75rem" }}>
              Amounts are stored by the backend. Calculated commission is
              retained even when a manual override is applied.
            </p>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Archive commission?"
        message="This commission will be soft-deleted and hidden from active lists. Financial history remains in the database."
        confirmLabel="Archive"
        danger
        loading={busy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
