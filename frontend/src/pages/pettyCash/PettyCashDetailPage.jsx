import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getPettyCash,
  deletePettyCash,
  createPettyTxn,
  createPettyReconciliation,
} from "../../api/pettyCash.js";
import { listEmployees } from "../../api/inventory.js";
import { ApiError } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import { formatApiError } from "../../utils/pettyCashHelpers.js";
import "../../styles/properties.css";

export default function PettyCashDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [account, setAccount] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(location.state?.flash || "");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [txnForm, setTxnForm] = useState({
    txnType: "out",
    amount: "",
    description: "",
    performedBy: "",
  });
  const [reconForm, setReconForm] = useState({
    countedBalance: "",
    notes: "",
    reconciledBy: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAccount(await getPettyCash(id));
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    listEmployees()
      .then((items) => setEmployees(Array.isArray(items) ? items : items.items || []))
      .catch(() => {});
  }, [load]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deletePettyCash(id);
      navigate("/petty-cash", { state: { flash: "Account archived" } });
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Delete failed");
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleTxn(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createPettyTxn(id, {
        txnType: txnForm.txnType,
        amount: Number(txnForm.amount),
        description: txnForm.description || null,
        performedBy: txnForm.performedBy ? Number(txnForm.performedBy) : null,
      });
      setTxnForm({ txnType: "out", amount: "", description: "", performedBy: "" });
      setToast("Transaction recorded");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRecon(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createPettyReconciliation(id, {
        countedBalance: Number(reconForm.countedBalance),
        notes: reconForm.notes || null,
        reconciledBy: reconForm.reconciledBy
          ? Number(reconForm.reconciledBy)
          : null,
      });
      setReconForm({ countedBalance: "", notes: "", reconciledBy: "" });
      setToast("Reconciliation recorded");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Reconciliation failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (!account) {
    return (
      <div className="properties-page">
        <div className="alert alert--error">{error || "Account not found"}</div>
        <Link to="/petty-cash">Back</Link>
      </div>
    );
  }

  return (
    <div className="properties-page">
      <p className="breadcrumb">
        <Link to="/petty-cash">Petty Cash</Link> / {account.accountName}
      </p>
      <div className="page-toolbar">
        <div>
          <h2 className="page-toolbar__title">{account.accountName}</h2>
          <p className="muted">
            Custodian: {account.custodianName || "—"} ·{" "}
            {account.isActive ? "Active" : "Inactive"}
          </p>
        </div>
        <div className="page-toolbar__actions">
          <Link to={`/petty-cash/${id}/edit`} className="btn btn--ghost btn--inline">
            Edit
          </Link>
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            onClick={() => setDeleteOpen(true)}
          >
            Archive
          </button>
        </div>
      </div>

      {toast ? <div className="alert alert--success">{toast}</div> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      <div className="detail-grid">
        <div>
          <span className="muted">Float</span>
          <div>{formatMoney(account.floatAmount)}</div>
        </div>
        <div>
          <span className="muted">Current balance</span>
          <div>{formatMoney(account.currentBalance)}</div>
        </div>
      </div>

      <section className="form-section" style={{ marginTop: "1.5rem" }}>
        <h3 className="form-section__title">Record transaction</h3>
        <form className="property-form" onSubmit={handleTxn}>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Type</span>
              <select
                value={txnForm.txnType}
                onChange={(e) => setTxnForm({ ...txnForm, txnType: e.target.value })}
                disabled={busy}
              >
                <option value="in">In (top-up)</option>
                <option value="out">Out (withdrawal)</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">Amount</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={txnForm.amount}
                onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                required
                disabled={busy}
              />
            </label>
            <label className="field">
              <span className="field__label">Performed by</span>
              <select
                value={txnForm.performedBy}
                onChange={(e) =>
                  setTxnForm({ ...txnForm, performedBy: e.target.value })
                }
                disabled={busy}
              >
                <option value="">Optional…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName || e.name || `#${e.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Description</span>
              <input
                type="text"
                value={txnForm.description}
                onChange={(e) =>
                  setTxnForm({ ...txnForm, description: e.target.value })
                }
                disabled={busy}
              />
            </label>
          </div>
          <button type="submit" className="btn btn--primary btn--inline" disabled={busy}>
            Record
          </button>
        </form>
      </section>

      <section className="form-section" style={{ marginTop: "1.5rem" }}>
        <h3 className="form-section__title">Recent transactions</h3>
        {(account.transactions || []).length === 0 ? (
          <p className="muted">No transactions yet.</p>
        ) : (
          <ul className="docs-list">
            {account.transactions.map((t) => (
              <li key={t.id} className="docs-list__item">
                <div>
                  <strong>
                    {t.txnType.toUpperCase()} {formatMoney(t.amount)}
                  </strong>
                  <div className="muted tiny">
                    {t.txnDate}
                    {t.description ? ` · ${t.description}` : ""}
                    {t.performedByName ? ` · ${t.performedByName}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="form-section" style={{ marginTop: "1.5rem" }}>
        <h3 className="form-section__title">Reconcile</h3>
        <form className="property-form" onSubmit={handleRecon}>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Counted balance</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={reconForm.countedBalance}
                onChange={(e) =>
                  setReconForm({ ...reconForm, countedBalance: e.target.value })
                }
                required
                disabled={busy}
              />
            </label>
            <label className="field">
              <span className="field__label">Reconciled by</span>
              <select
                value={reconForm.reconciledBy}
                onChange={(e) =>
                  setReconForm({ ...reconForm, reconciledBy: e.target.value })
                }
                disabled={busy}
              >
                <option value="">Optional…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName || e.name || `#${e.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Notes</span>
              <input
                type="text"
                value={reconForm.notes}
                onChange={(e) => setReconForm({ ...reconForm, notes: e.target.value })}
                disabled={busy}
              />
            </label>
          </div>
          <p className="muted tiny">
            System balance is {formatMoney(account.currentBalance)} — variance is
            calculated automatically.
          </p>
          <button type="submit" className="btn btn--primary btn--inline" disabled={busy}>
            Save reconciliation
          </button>
        </form>

        {(account.reconciliations || []).length > 0 ? (
          <ul className="docs-list" style={{ marginTop: "1rem" }}>
            {account.reconciliations.map((r) => (
              <li key={r.id} className="docs-list__item">
                <div>
                  <strong>{r.reconciledOn}</strong>
                  <div className="muted tiny">
                    System {formatMoney(r.systemBalance)} · Counted{" "}
                    {formatMoney(r.countedBalance)} · Variance {formatMoney(r.variance)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <ConfirmDialog
        open={deleteOpen}
        title="Archive account?"
        message={`Move “${account.accountName}” to the recycle bin?`}
        confirmLabel="Archive"
        busy={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
