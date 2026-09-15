import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getPayment, reversePayment } from "../../api/payments.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  formatApiError,
  formatLabel,
  installmentRemaining,
} from "../../utils/paymentHelpers.js";
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

export default function PaymentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [actionError, setActionError] = useState("");
  const [reverseOpen, setReverseOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getPayment(id);
      setPayment(data);
    } catch (err) {
      setPayment(null);
      setError(
        err instanceof ApiError ? formatApiError(err) : "Failed to load payment"
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

  async function handleReverse() {
    setBusy(true);
    setActionError("");
    try {
      await reversePayment(id);
      navigate("/payments", {
        replace: true,
        state: { flash: "Payment reversed and moved to recycle bin" },
      });
    } catch (err) {
      setActionError(
        err instanceof ApiError ? formatApiError(err) : "Reversal failed"
      );
      setReverseOpen(false);
    } finally {
      setBusy(false);
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

  if (error || !payment) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{error || "Payment not found"}</p>
        <Link to="/payments" className="btn btn--ghost">
          Back to list
        </Link>
      </div>
    );
  }

  const booking = payment.booking;
  const installment = payment.installment;

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/payments" className="crumb">
              Payments
            </Link>
            <span aria-hidden="true"> / </span>
            {payment.paymentCode || `#${payment.id}`}
          </p>
          <h2 className="page-toolbar__title">
            {formatMoney(payment.amount)}
          </h2>
          <div className="detail-meta">
            <span className="muted">
              {payment.paymentDate
                ? String(payment.paymentDate).slice(0, 10)
                : "—"}{" "}
              · {payment.paymentMethodName || "Method"}
            </span>
          </div>
        </div>
        <div className="toolbar-actions">
          <Link to={`/payments/${payment.id}/edit`} className="btn btn--ghost">
            Edit
          </Link>
          <button
            type="button"
            className="btn btn--danger-outline"
            onClick={() => setReverseOpen(true)}
          >
            Reverse
          </button>
        </div>
      </div>

      {flash ? <div className="toast toast--success">{flash}</div> : null}
      {actionError ? (
        <div className="alert alert--error" role="alert">
          {actionError}
        </div>
      ) : null}

      <div className="detail-layout">
        <section className="detail-card">
          <h3 className="detail-card__title">Payment information</h3>
          <dl className="detail-list">
            <DetailRow label="Code" value={payment.paymentCode} />
            <DetailRow label="Amount" value={formatMoney(payment.amount)} />
            <DetailRow
              label="Payment date"
              value={
                payment.paymentDate
                  ? String(payment.paymentDate).slice(0, 10)
                  : null
              }
            />
            <DetailRow
              label="Method"
              value={payment.paymentMethodName}
            />
            <DetailRow label="Bank" value={payment.bankName} />
            <DetailRow label="Reference" value={payment.referenceNumber} />
            <DetailRow label="Notes" value={payment.notes} />
            <DetailRow
              label="Received by (employee id)"
              value={payment.receivedBy}
            />
            <DetailRow
              label="Created"
              value={
                payment.createdAt
                  ? new Date(payment.createdAt).toLocaleString()
                  : null
              }
            />
            <DetailRow
              label="Updated"
              value={
                payment.updatedAt
                  ? new Date(payment.updatedAt).toLocaleString()
                  : null
              }
            />
          </dl>
        </section>

        <div className="detail-side">
          <section className="detail-card">
            <h3 className="detail-card__title">Booking</h3>
            <dl className="detail-list">
              <DetailRow
                label="Code"
                value={
                  <Link
                    to={`/bookings/${payment.bookingId}`}
                    className="linkish"
                  >
                    {payment.bookingCode ||
                      booking?.bookingCode ||
                      `#${payment.bookingId}`}
                  </Link>
                }
              />
              <DetailRow
                label="Status"
                value={
                  <StatusBadge
                    status={payment.bookingStatus || booking?.status}
                  />
                }
              />
              <DetailRow
                label="Client"
                value={
                  payment.clientId ? (
                    <Link
                      to={`/clients/${payment.clientId}`}
                      className="linkish"
                    >
                      {payment.clientName || `Client #${payment.clientId}`}
                    </Link>
                  ) : (
                    payment.clientName
                  )
                }
              />
              <DetailRow
                label="Property"
                value={
                  payment.propertyId ? (
                    <Link
                      to={`/properties/${payment.propertyId}`}
                      className="linkish"
                    >
                      {payment.propertyCode ||
                        `Property #${payment.propertyId}`}
                    </Link>
                  ) : (
                    payment.propertyCode
                  )
                }
              />
            </dl>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Financial context</h3>
            <dl className="detail-list">
              <DetailRow
                label="Booking total"
                value={
                  booking?.totalPrice != null
                    ? formatMoney(booking.totalPrice)
                    : null
                }
              />
              <DetailRow
                label="Down payment"
                value={
                  booking?.bookingAmount != null
                    ? formatMoney(booking.bookingAmount)
                    : null
                }
              />
              <DetailRow
                label="Booking remaining"
                value={
                  booking?.remainingBalance != null
                    ? formatMoney(booking.remainingBalance)
                    : payment.remainingBalanceAfter != null
                      ? formatMoney(payment.remainingBalanceAfter)
                      : null
                }
              />
            </dl>
            <p className="form-hint">
              Remaining = total − down payment − SUM(active payments). Values
              shown are from the backend.
            </p>
          </section>

          {installment ? (
            <section className="detail-card">
              <h3 className="detail-card__title">Linked installment</h3>
              <dl className="detail-list">
                <DetailRow
                  label="Number"
                  value={installment.installmentNumber}
                />
                <DetailRow
                  label="Due date"
                  value={
                    installment.dueDate
                      ? String(installment.dueDate).slice(0, 10)
                      : null
                  }
                />
                <DetailRow
                  label="Amount due"
                  value={formatMoney(installment.amountDue)}
                />
                <DetailRow
                  label="Amount paid"
                  value={formatMoney(installment.amountPaid)}
                />
                <DetailRow
                  label="Remaining"
                  value={formatMoney(installmentRemaining(installment))}
                />
                <DetailRow
                  label="Status"
                  value={<StatusBadge status={installment.status} />}
                />
              </dl>
            </section>
          ) : (
            <section className="detail-card">
              <h3 className="detail-card__title">Linked installment</h3>
              <p className="muted">No installment linked to this payment.</p>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={reverseOpen}
        title="Reverse payment?"
        message={`"${payment.paymentCode}" will be soft-deleted. The backend will restore booking remaining balance and any linked installment amounts.`}
        confirmLabel="Reverse payment"
        danger
        loading={busy}
        onCancel={() => setReverseOpen(false)}
        onConfirm={handleReverse}
      />
    </div>
  );
}
