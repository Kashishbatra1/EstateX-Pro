import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getExpense,
  deleteExpense,
  updateExpenseApproval,
} from "../../api/expenses.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import FavoriteToggle from "../../components/FavoriteToggle.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  formatLabel,
  formatApiError,
  canEditExpense,
  canApproveExpense,
} from "../../utils/expenseHelpers.js";
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

export default function ExpenseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getExpense(id);
      setExpense(data);
    } catch (err) {
      setExpense(null);
      setError(
        err instanceof ApiError ? formatApiError(err) : "Failed to load expense"
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

  async function handleApprove() {
    setBusy(true);
    setActionError("");
    try {
      const updated = await updateExpenseApproval(id, {
        approvalStatus: "approved",
      });
      setExpense(updated);
      setFlash("Expense approved");
    } catch (err) {
      setActionError(
        err instanceof ApiError ? formatApiError(err) : "Approve failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      setActionError("Rejection reason is required");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const updated = await updateExpenseApproval(id, {
        approvalStatus: "rejected",
        rejectionReason: rejectReason.trim(),
      });
      setExpense(updated);
      setRejectOpen(false);
      setRejectReason("");
      setFlash("Expense rejected");
    } catch (err) {
      setActionError(
        err instanceof ApiError ? formatApiError(err) : "Reject failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    setBusy(true);
    setActionError("");
    try {
      await deleteExpense(id);
      navigate("/expenses", {
        replace: true,
        state: { flash: "Expense moved to recycle bin" },
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
        <p>Loading expense…</p>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{error || "Expense not found"}</p>
        <Link to="/expenses" className="btn btn--ghost">
          Back to list
        </Link>
      </div>
    );
  }

  const status = expense.approvalStatus;

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/expenses" className="crumb">
              Expenses
            </Link>
            <span aria-hidden="true"> / </span>
            {expense.expenseCode || `#${expense.id}`}
          </p>
          <h2 className="page-toolbar__title">
            {formatMoney(expense.amount)}
          </h2>
          <div className="detail-meta">
            <StatusBadge status={status} />
            <span className="muted">
              {expense.categoryName || "Category"} ·{" "}
              {expense.expenseDate
                ? String(expense.expenseDate).slice(0, 10)
                : "—"}
            </span>
          </div>
        </div>
        <div className="toolbar-actions">
          <FavoriteToggle entityType="expense" entityId={expense.id} />
          {canEditExpense(status) ? (
            <Link to={`/expenses/${expense.id}/edit`} className="btn btn--ghost">
              Edit
            </Link>
          ) : null}
          {canApproveExpense(status) ? (
            <>
              <button
                type="button"
                className="btn btn--primary btn--inline"
                disabled={busy}
                onClick={handleApprove}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn btn--danger-outline"
                disabled={busy}
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="btn btn--danger-outline"
            onClick={() => setArchiveOpen(true)}
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

      <div className="detail-layout">
        <section className="detail-card">
          <h3 className="detail-card__title">Expense information</h3>
          <dl className="detail-list">
            <DetailRow label="Code" value={expense.expenseCode} />
            <DetailRow
              label="Date"
              value={
                expense.expenseDate
                  ? String(expense.expenseDate).slice(0, 10)
                  : null
              }
            />
            <DetailRow label="Category" value={expense.categoryName} />
            <DetailRow label="Subcategory" value={expense.subcategoryName} />
            <DetailRow label="Amount" value={formatMoney(expense.amount)} />
            <DetailRow
              label="GST / sales tax"
              value={formatMoney(expense.gstSalesTax)}
            />
            <DetailRow
              label="Remaining amount"
              value={formatMoney(expense.remainingAmount)}
            />
            <DetailRow label="Description" value={expense.description} />
            <DetailRow label="Device / item" value={expense.deviceOrItemName} />
            <DetailRow label="Quantity" value={expense.quantity} />
            <DetailRow label="Receipt path" value={expense.receiptPath} />
            <DetailRow
              label="Reimbursement"
              value={formatLabel(expense.reimbursementStatus)}
            />
            <DetailRow
              label="Created"
              value={
                expense.createdAt
                  ? new Date(expense.createdAt).toLocaleString()
                  : null
              }
            />
            <DetailRow
              label="Updated"
              value={
                expense.updatedAt
                  ? new Date(expense.updatedAt).toLocaleString()
                  : null
              }
            />
          </dl>
        </section>

        <div className="detail-side">
          <section className="detail-card">
            <h3 className="detail-card__title">Relationships</h3>
            <dl className="detail-list">
              <DetailRow
                label="Paid by"
                value={
                  expense.paidByEmployeeName ||
                  (expense.paidByEmployeeId
                    ? `Employee #${expense.paidByEmployeeId}`
                    : null)
                }
              />
              <DetailRow
                label="Payment method"
                value={expense.paymentMethodName}
              />
              <DetailRow label="Vendor" value={expense.vendorName} />
              <DetailRow
                label="Property"
                value={
                  expense.propertyId ? (
                    <Link
                      to={`/properties/${expense.propertyId}`}
                      className="linkish"
                    >
                      {expense.propertyCode ||
                        `Property #${expense.propertyId}`}
                    </Link>
                  ) : null
                }
              />
              <DetailRow
                label="Inventory item"
                value={
                  expense.inventoryItemId ? (
                    <Link
                      to={`/inventory/${expense.inventoryItemId}`}
                      className="linkish"
                    >
                      Item #{expense.inventoryItemId}
                      {expense.deviceOrItemName
                        ? ` — ${expense.deviceOrItemName}`
                        : ""}
                    </Link>
                  ) : null
                }
              />
            </dl>
            <p className="form-hint">
              Booking and bank account are not linked on expenses in this API.
            </p>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Approval</h3>
            <dl className="detail-list">
              <DetailRow
                label="Status"
                value={<StatusBadge status={expense.approvalStatus} />}
              />
              <DetailRow label="Approved by" value={expense.approvedBy} />
              <DetailRow
                label="Approved at"
                value={
                  expense.approvedAt
                    ? new Date(expense.approvedAt).toLocaleString()
                    : null
                }
              />
              <DetailRow
                label="Rejection reason"
                value={expense.rejectionReason}
              />
            </dl>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={archiveOpen}
        title="Archive expense?"
        message={`"${expense.expenseCode}" will be soft-deleted and removed from the active list.`}
        confirmLabel="Archive"
        danger
        loading={busy}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={handleArchive}
      />

      {rejectOpen ? (
        <div
          className="dialog-backdrop"
          role="presentation"
          onClick={() => !busy && setRejectOpen(false)}
        >
          <form
            className="dialog dialog--wide"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              handleReject();
            }}
          >
            <h2 className="dialog__title">Reject expense</h2>
            <p className="dialog__message">
              Rejection is final. A reason is required by the backend.
            </p>
            <label className="field">
              <span className="field__label">Rejection reason *</span>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                disabled={busy}
                required
              />
            </label>
            <div className="dialog__actions">
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() => setRejectOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn--danger" disabled={busy}>
                {busy ? "Rejecting…" : "Reject expense"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
