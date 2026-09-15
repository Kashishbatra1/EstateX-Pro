import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getBooking,
  updateBookingStatus,
  cancelBooking,
  completeBooking,
  deleteBooking,
} from "../../api/bookings.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import FavoriteToggle from "../../components/FavoriteToggle.jsx";
import CancelBookingDialog from "../../components/bookings/CancelBookingDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  formatLabel,
  formatApiError,
  canEditBooking,
  canConfirmBooking,
  canCompleteBooking,
  canCancelBooking,
  canArchiveBooking,
} from "../../utils/bookingHelpers.js";
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

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getBooking(id);
      setBooking(data);
    } catch (err) {
      setBooking(null);
      setError(
        err instanceof ApiError ? formatApiError(err) : "Failed to load booking"
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

  async function handleConfirm() {
    setBusy(true);
    setActionError("");
    try {
      const updated = await updateBookingStatus(id, { status: "confirmed" });
      setBooking(updated);
      setConfirmOpen(false);
      setFlash("Booking confirmed");
    } catch (err) {
      setActionError(
        err instanceof ApiError ? formatApiError(err) : "Confirm failed"
      );
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    setBusy(true);
    setActionError("");
    try {
      const updated = await completeBooking(id);
      setBooking(updated);
      setCompleteOpen(false);
      setFlash("Booking completed");
    } catch (err) {
      setActionError(
        err instanceof ApiError ? formatApiError(err) : "Complete failed"
      );
      setCompleteOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(form) {
    if (!form.cancellationReason) {
      setActionError("Cancellation reason is required");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const payload = {
        cancellationReason: form.cancellationReason,
      };
      if (form.refundAmount !== "") {
        const amount = Number(form.refundAmount);
        if (Number.isNaN(amount) || amount < 0) {
          setActionError("Refund amount must be a non-negative number");
          setBusy(false);
          return;
        }
        payload.refundAmount = amount;
      }
      if (form.refundDetails) payload.refundDetails = form.refundDetails;

      const updated = await cancelBooking(id, payload);
      setBooking(updated);
      setCancelOpen(false);
      setFlash("Booking cancelled");
    } catch (err) {
      setActionError(
        err instanceof ApiError ? formatApiError(err) : "Cancel failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    setBusy(true);
    setActionError("");
    try {
      await deleteBooking(id);
      navigate("/bookings", {
        replace: true,
        state: { flash: "Booking moved to recycle bin" },
      });
    } catch (err) {
      setActionError(
        err instanceof ApiError ? formatApiError(err) : "Archive failed"
      );
      setArchiveOpen(false);
    } finally {
      setBusy(false);
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

  if (error || !booking) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{error || "Booking not found"}</p>
        <Link to="/bookings" className="btn btn--ghost">
          Back to list
        </Link>
      </div>
    );
  }

  const installments = booking.installments || [];
  const status = booking.status;

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/bookings" className="crumb">
              Bookings
            </Link>
            <span aria-hidden="true"> / </span>
            {booking.bookingCode || `#${booking.id}`}
          </p>
          <h2 className="page-toolbar__title">
            {booking.propertyTitle || "Booking"}
          </h2>
          <div className="detail-meta">
            <StatusBadge status={status} />
            <span className="muted">
              Booked{" "}
              {booking.bookedAt
                ? new Date(booking.bookedAt).toLocaleString()
                : "—"}
            </span>
          </div>
        </div>
        <div className="toolbar-actions">
          <FavoriteToggle entityType="booking" entityId={booking.id} />
          {canEditBooking(status) ? (
            <Link to={`/bookings/${booking.id}/edit`} className="btn btn--ghost">
              Edit
            </Link>
          ) : null}
          {canCancelBooking(status) || canConfirmBooking(status) ? (
            <Link
              to={`/payments/new?bookingId=${booking.id}`}
              className="btn btn--ghost"
            >
              Record payment
            </Link>
          ) : null}
          <Link
            to={`/commissions/new?propertyId=${booking.propertyId}&bookingId=${booking.id}`}
            className="btn btn--ghost"
          >
            Add commission
          </Link>
          {canConfirmBooking(status) ? (
            <button
              type="button"
              className="btn btn--primary btn--inline"
              onClick={() => setConfirmOpen(true)}
            >
              Confirm
            </button>
          ) : null}
          {canCompleteBooking(status) ? (
            <button
              type="button"
              className="btn btn--primary btn--inline"
              onClick={() => setCompleteOpen(true)}
            >
              Complete
            </button>
          ) : null}
          {canCancelBooking(status) ? (
            <button
              type="button"
              className="btn btn--danger-outline"
              onClick={() => setCancelOpen(true)}
            >
              Cancel
            </button>
          ) : null}
          {canArchiveBooking(status) ? (
            <button
              type="button"
              className="btn btn--danger-outline"
              onClick={() => setArchiveOpen(true)}
            >
              Archive
            </button>
          ) : null}
        </div>
      </div>

      {flash ? <div className="toast toast--success">{flash}</div> : null}
      {actionError ? (
        <div className="alert alert--error" role="alert">
          {actionError}
        </div>
      ) : null}

      <ol className="workflow-steps" aria-label="Booking workflow">
        {["pending", "confirmed", "completed"].map((step, index) => {
          const order = { pending: 0, confirmed: 1, completed: 2, cancelled: -1 };
          const current = order[status] ?? -1;
          const stepIndex = index;
          const isCancelled = status === "cancelled";
          const done = !isCancelled && current >= stepIndex;
          const active = !isCancelled && current === stepIndex;
          return (
            <li
              key={step}
              className={`workflow-steps__item${
                done ? " is-done" : ""
              }${active ? " is-active" : ""}${
                isCancelled ? " is-muted" : ""
              }`}
            >
              <span className="workflow-steps__dot" aria-hidden="true" />
              <span className="workflow-steps__label">
                {formatLabel(step)}
              </span>
            </li>
          );
        })}
        <li
          className={`workflow-steps__item${
            status === "cancelled" ? " is-active is-cancel" : " is-muted"
          }`}
        >
          <span className="workflow-steps__dot" aria-hidden="true" />
          <span className="workflow-steps__label">Cancelled</span>
        </li>
      </ol>

      <div className="detail-layout">
        <div className="detail-side" style={{ display: "grid", gap: "1rem" }}>
          <section className="detail-card">
            <h3 className="detail-card__title">Booking information</h3>
            <dl className="detail-list">
              <DetailRow label="Code" value={booking.bookingCode} />
              <DetailRow label="Status" value={formatLabel(booking.status)} />
              <DetailRow
                label="Booked at"
                value={
                  booking.bookedAt
                    ? new Date(booking.bookedAt).toLocaleString()
                    : null
                }
              />
              <DetailRow
                label="Confirmed at"
                value={
                  booking.confirmedAt
                    ? new Date(booking.confirmedAt).toLocaleString()
                    : null
                }
              />
              <DetailRow
                label="Completed at"
                value={
                  booking.completedAt
                    ? new Date(booking.completedAt).toLocaleString()
                    : null
                }
              />
              <DetailRow
                label="Cancelled at"
                value={
                  booking.cancelledAt
                    ? new Date(booking.cancelledAt).toLocaleString()
                    : null
                }
              />
              <DetailRow
                label="Expiry"
                value={
                  booking.bookingExpiryDate
                    ? String(booking.bookingExpiryDate).slice(0, 10)
                    : null
                }
              />
              <DetailRow
                label="Token / receipt"
                value={booking.tokenReceiptNumber}
              />
              <DetailRow
                label="Agreement"
                value={
                  booking.digitalAgreementUrl ? (
                    <a
                      href={booking.digitalAgreementUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open link
                    </a>
                  ) : null
                }
              />
            </dl>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Property</h3>
            <dl className="detail-list">
              <DetailRow
                label="Title"
                value={
                  <Link
                    to={`/properties/${booking.propertyId}`}
                    className="linkish"
                  >
                    {booking.propertyTitle || `Property #${booking.propertyId}`}
                  </Link>
                }
              />
              <DetailRow label="Code" value={booking.propertyCode} />
              <DetailRow
                label="Property status"
                value={formatLabel(booking.propertyStatus)}
              />
            </dl>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Client</h3>
            <dl className="detail-list">
              <DetailRow
                label="Name"
                value={
                  <Link to={`/clients/${booking.clientId}`} className="linkish">
                    {booking.clientName || `Client #${booking.clientId}`}
                  </Link>
                }
              />
              <DetailRow label="Client ID" value={booking.clientId} />
            </dl>
          </section>
        </div>

        <div className="detail-side">
          <section className="detail-card">
            <h3 className="detail-card__title">Financial summary</h3>
            <dl className="detail-list">
              <DetailRow
                label="Total price"
                value={formatMoney(booking.totalPrice)}
              />
              <DetailRow
                label="Down payment"
                value={formatMoney(booking.bookingAmount)}
              />
              <DetailRow
                label="Remaining balance"
                value={formatMoney(booking.remainingBalance)}
              />
              <DetailRow
                label="Installment plan"
                value={booking.installmentPlanName}
              />
              <DetailRow
                label="Monthly installment"
                value={
                  booking.monthlyInstallmentAmount != null
                    ? formatMoney(booking.monthlyInstallmentAmount)
                    : null
                }
              />
            </dl>
            <p className="form-hint">
              Remaining = total price − down payment. Payments update balances
              when recorded.
            </p>
            <div
              className="toolbar-actions"
              style={{ flexWrap: "wrap", marginTop: "0.75rem" }}
            >
              <Link
                to={`/commissions?bookingId=${booking.id}`}
                className="btn btn--ghost btn--inline"
              >
                View commissions
              </Link>
              <Link
                to={`/commissions/new?propertyId=${booking.propertyId}&bookingId=${booking.id}`}
                className="btn btn--primary btn--inline"
              >
                Add commission
              </Link>
            </div>
          </section>

          {status === "cancelled" ? (
            <section className="detail-card">
              <h3 className="detail-card__title">Cancellation</h3>
              <dl className="detail-list">
                <DetailRow
                  label="Reason"
                  value={booking.cancellationReason}
                />
                <DetailRow
                  label="Refund amount"
                  value={
                    booking.refundAmount != null
                      ? formatMoney(booking.refundAmount)
                      : null
                  }
                />
                <DetailRow
                  label="Refund details"
                  value={booking.refundDetails}
                />
              </dl>
            </section>
          ) : null}

          <section className="detail-card">
            <h3 className="detail-card__title">Installments</h3>
            {installments.length === 0 ? (
              <p className="muted">No installment schedule on this booking.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Due</th>
                      <th>Due amount</th>
                      <th>Paid</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((row) => (
                      <tr key={row.id}>
                        <td>{row.installmentNumber}</td>
                        <td>
                          {row.dueDate
                            ? String(row.dueDate).slice(0, 10)
                            : "—"}
                        </td>
                        <td>{formatMoney(row.amountDue)}</td>
                        <td>{formatMoney(row.amountPaid)}</td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm booking?"
        message="The backend will mark this booking confirmed and may reserve the property if it is still available."
        confirmLabel="Confirm booking"
        loading={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />

      <ConfirmDialog
        open={completeOpen}
        title="Complete booking?"
        message="The backend will complete this booking and update the property to sold or rented based on property purpose."
        confirmLabel="Complete booking"
        loading={busy}
        onCancel={() => setCompleteOpen(false)}
        onConfirm={handleComplete}
      />

      <CancelBookingDialog
        open={cancelOpen}
        loading={busy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={handleCancel}
      />

      <ConfirmDialog
        open={archiveOpen}
        title="Archive booking?"
        message={`"${booking.bookingCode}" will be soft-deleted and removed from the active list.`}
        confirmLabel="Archive"
        danger
        loading={busy}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={handleArchive}
      />
    </div>
  );
}
