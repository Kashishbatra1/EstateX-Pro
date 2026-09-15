import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getBudget,
  deleteBudget,
  addBudgetLine,
  deleteBudgetLine,
} from "../../api/budgets.js";
import { listExpenses } from "../../api/expenses.js";
import { ApiError } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import { collectLookupsFromExpenses } from "../../utils/expenseHelpers.js";
import { formatApiError, formatPeriod } from "../../utils/budgetHelpers.js";
import "../../styles/properties.css";

export default function BudgetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [budget, setBudget] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(location.state?.flash || "");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lineForm, setLineForm] = useState({ categoryId: "", allocatedAmount: "", notes: "" });
  const [lineBusy, setLineBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getBudget(id);
      setBudget(data);
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Failed to load budget");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    listExpenses({ limit: 50 })
      .then((data) => {
        const lookups = collectLookupsFromExpenses(data.items || []);
        setCategories(lookups.categories);
      })
      .catch(() => {});
  }, [load]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteBudget(id);
      navigate("/budgets", { state: { flash: "Budget archived" } });
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Delete failed");
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddLine(e) {
    e.preventDefault();
    setLineBusy(true);
    setError("");
    try {
      await addBudgetLine(id, {
        categoryId: Number(lineForm.categoryId),
        allocatedAmount: Number(lineForm.allocatedAmount),
        notes: lineForm.notes || null,
      });
      setLineForm({ categoryId: "", allocatedAmount: "", notes: "" });
      setToast("Category line added");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Failed to add line");
    } finally {
      setLineBusy(false);
    }
  }

  async function handleDeleteLine(lineId) {
    setLineBusy(true);
    try {
      await deleteBudgetLine(id, lineId);
      setToast("Line removed");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Failed to remove line");
    } finally {
      setLineBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (!budget) {
    return (
      <div className="properties-page">
        <div className="alert alert--error">{error || "Budget not found"}</div>
        <Link to="/budgets">Back</Link>
      </div>
    );
  }

  return (
    <div className="properties-page">
      <p className="breadcrumb">
        <Link to="/budgets">Budgets</Link> / {budget.name}
      </p>
      <div className="page-toolbar">
        <div>
          <h2 className="page-toolbar__title">{budget.name}</h2>
          <p className="muted">{formatPeriod(budget)}</p>
        </div>
        <div className="page-toolbar__actions">
          <Link to={`/budgets/${id}/edit`} className="btn btn--ghost btn--inline">
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
          <span className="muted">Total</span>
          <div>{formatMoney(budget.totalAmount)}</div>
        </div>
        <div>
          <span className="muted">Spent</span>
          <div>{formatMoney(budget.spentAmount)}</div>
        </div>
        <div>
          <span className="muted">Remaining</span>
          <div>{formatMoney(budget.remainingAmount)}</div>
        </div>
        <div>
          <span className="muted">Utilization</span>
          <div>
            {budget.utilizationPct}%
            {budget.isOverAlert ? " (over alert)" : ""}
          </div>
        </div>
        <div>
          <span className="muted">Alert at</span>
          <div>{budget.alertThresholdPct}%</div>
        </div>
      </div>

      {budget.notes ? <p className="muted">{budget.notes}</p> : null}

      <section className="form-section" style={{ marginTop: "1.5rem" }}>
        <h3 className="form-section__title">Category lines</h3>
        {(budget.lines || []).length === 0 ? (
          <p className="muted">No category allocations yet.</p>
        ) : (
          <ul className="docs-list">
            {budget.lines.map((line) => (
              <li key={line.id} className="docs-list__item">
                <div>
                  <strong>{line.categoryName || `Category #${line.categoryId}`}</strong>
                  <div className="muted tiny">
                    Allocated {formatMoney(line.allocatedAmount)} · Spent{" "}
                    {formatMoney(line.spentAmount)} · {line.utilizationPct}%
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--inline"
                  disabled={lineBusy}
                  onClick={() => handleDeleteLine(line.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="property-form" onSubmit={handleAddLine} style={{ marginTop: "1rem" }}>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Category</span>
              {categories.length > 0 ? (
                <select
                  value={lineForm.categoryId}
                  onChange={(e) =>
                    setLineForm({ ...lineForm, categoryId: e.target.value })
                  }
                  required
                  disabled={lineBusy}
                >
                  <option value="">Select…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.categoryName || `#${c.id}`}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  placeholder="expense_categories.id"
                  value={lineForm.categoryId}
                  onChange={(e) =>
                    setLineForm({ ...lineForm, categoryId: e.target.value })
                  }
                  required
                  disabled={lineBusy}
                />
              )}
            </label>
            <label className="field">
              <span className="field__label">Allocated amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={lineForm.allocatedAmount}
                onChange={(e) =>
                  setLineForm({ ...lineForm, allocatedAmount: e.target.value })
                }
                required
                disabled={lineBusy}
              />
            </label>
            <label className="field">
              <span className="field__label">Notes</span>
              <input
                type="text"
                value={lineForm.notes}
                onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })}
                disabled={lineBusy}
              />
            </label>
          </div>
          <button type="submit" className="btn btn--primary btn--inline" disabled={lineBusy}>
            Add line
          </button>
        </form>
      </section>

      <ConfirmDialog
        open={deleteOpen}
        title="Archive budget?"
        message={`Move “${budget.name}” to the recycle bin?`}
        confirmLabel="Archive"
        busy={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
