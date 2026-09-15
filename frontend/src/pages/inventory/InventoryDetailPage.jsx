import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getInventoryItem,
  listInventoryTransactions,
  listEmployees,
  assignInventoryItem,
  returnInventoryItem,
  adjustInventoryItem,
  deleteInventoryItem,
} from "../../api/inventory.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import { formatLabel, formatApiError } from "../../utils/inventoryHelpers.js";
import "../../styles/properties.css";

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value === null || value === undefined || value === "" ? "—" : value}</dd>
    </div>
  );
}

export default function InventoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [item, setItem] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [busy, setBusy] = useState(false);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [actionError, setActionError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, txns, emps] = await Promise.all([
        getInventoryItem(id),
        listInventoryTransactions(id),
        listEmployees(),
      ]);
      setItem(data);
      setTransactions(txns);
      setEmployees(emps);
      if (data?.assignedTo) setAssignEmployeeId(String(data.assignedTo));
    } catch (err) {
      setItem(null);
      setError(
        err instanceof ApiError ? formatApiError(err) : "Failed to load item"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(""), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  async function handleAssign(e) {
    e.preventDefault();
    setActionError("");
    if (!assignEmployeeId) {
      setActionError("Select an employee to assign");
      return;
    }
    setBusy(true);
    try {
      await assignInventoryItem(id, {
        employeeId: Number(assignEmployeeId),
        notes: assignNotes.trim() || null,
      });
      setAssignNotes("");
      setFlash("Item assigned");
      await load();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? formatApiError(err) : "Assign failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReturn() {
    setActionError("");
    setBusy(true);
    try {
      await returnInventoryItem(id, { notes: "Returned to office stock" });
      setFlash("Item returned to stock");
      await load();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? formatApiError(err) : "Return failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAdjust(e) {
    e.preventDefault();
    setActionError("");
    const delta = Number(adjustDelta);
    if (!adjustDelta || Number.isNaN(delta) || delta === 0) {
      setActionError("Enter a non-zero quantity change");
      return;
    }
    setBusy(true);
    try {
      await adjustInventoryItem(id, {
        quantityChange: delta,
        notes: adjustNotes.trim() || null,
      });
      setAdjustDelta("");
      setAdjustNotes("");
      setFlash("Quantity adjusted");
      await load();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? formatApiError(err) : "Adjust failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await deleteInventoryItem(id);
      navigate("/inventory", { state: { flash: "Inventory item archived" } });
    } catch (err) {
      setActionError(
        err instanceof ApiError ? formatApiError(err) : "Archive failed"
      );
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading inventory item…</p>;

  if (!item) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        {error || "Item not found"}
        <Link to="/inventory" className="btn btn--ghost">
          Back to inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/inventory" className="crumb">
              Inventory
            </Link>
          </p>
          <h2 className="page-toolbar__title">{item.itemName}</h2>
          <div className="detail-meta">
            <StatusBadge status={item.status} />
            <span className="muted tiny">
              {item.quantity} {item.unit || "pcs"}
            </span>
          </div>
        </div>
        <div className="toolbar-actions">
          <Link to={`/inventory/${item.id}/edit`} className="btn btn--ghost">
            Edit
          </Link>
          <button
            type="button"
            className="btn btn--danger-text"
            onClick={() => setDeleteOpen(true)}
          >
            Archive
          </button>
        </div>
      </div>

      {flash ? (
        <div className="alert alert--success" role="status">
          {flash}
        </div>
      ) : null}
      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}
      {actionError ? (
        <div className="alert alert--error" role="alert">
          {actionError}
        </div>
      ) : null}

      <div className="detail-layout">
        <div className="detail-stack">
          <section className="detail-card">
            <h3 className="detail-card__title">Details</h3>
            <dl className="detail-list detail-list--2">
              <DetailRow label="Type" value={item.itemType} />
              <DetailRow
                label="Quantity"
                value={`${item.quantity} ${item.unit || "pcs"}`}
              />
              <DetailRow
                label="Assigned to"
                value={item.assignedToName || "—"}
              />
              <DetailRow label="Location" value={item.locationNotes} />
              <DetailRow label="Purchase date" value={item.purchaseDate} />
              <DetailRow
                label="Purchase cost"
                value={
                  item.purchaseCost != null
                    ? formatMoney(item.purchaseCost)
                    : null
                }
              />
              <DetailRow label="Notes" value={item.notes} />
            </dl>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Purchase & movement history</h3>
            {transactions.length === 0 ? (
              <p className="muted">No transactions yet.</p>
            ) : (
              <ul className="docs-list">
                {transactions.map((t) => (
                  <li key={t.id} className="docs-list__item">
                    <div>
                      <strong>{formatLabel(t.txnType)}</strong>
                      <div className="muted tiny">
                        qty Δ {t.quantityChange}
                        {t.assignedToName ? ` · ${t.assignedToName}` : ""}
                        {t.expenseCode ? (
                          <>
                            {" · expense "}
                            <Link to={`/expenses/${t.expenseId}`}>
                              {t.expenseCode}
                            </Link>
                          </>
                        ) : null}
                      </div>
                      {t.notes ? (
                        <div className="muted tiny">{t.notes}</div>
                      ) : null}
                      <div className="muted tiny">
                        {t.createdAt
                          ? new Date(t.createdAt).toLocaleString()
                          : ""}
                        {t.performedByName ? ` · ${t.performedByName}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="detail-side">
          <section className="detail-card">
            <h3 className="detail-card__title">Assign to whom</h3>
            <form className="docs-form" onSubmit={handleAssign}>
              <label className="field">
                <span className="field__label">Employee *</span>
                <select
                  value={assignEmployeeId}
                  onChange={(e) => setAssignEmployeeId(e.target.value)}
                  disabled={busy || item.status === "retired"}
                >
                  <option value="">Select employee…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                      {e.designation ? ` (${e.designation})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Notes</span>
                <input
                  type="text"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  disabled={busy}
                />
              </label>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn--primary btn--inline"
                  disabled={busy || item.status === "retired"}
                >
                  Assign
                </button>
                {item.assignedTo ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--inline"
                    disabled={busy}
                    onClick={handleReturn}
                  >
                    Return to stock
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Adjust quantity</h3>
            <form className="docs-form" onSubmit={handleAdjust}>
              <label className="field">
                <span className="field__label">Change (+/−) *</span>
                <input
                  type="number"
                  step="1"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  disabled={busy}
                  placeholder="e.g. 1 or -1"
                />
              </label>
              <label className="field">
                <span className="field__label">Notes</span>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  disabled={busy}
                />
              </label>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn--primary btn--inline"
                  disabled={busy}
                >
                  Apply adjustment
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Archive inventory item?"
        message={`"${item.itemName}" will be soft-deleted. Transaction history remains stored.`}
        confirmLabel="Archive"
        danger
        loading={busy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
