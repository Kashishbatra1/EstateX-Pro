import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  listBudgets,
  deleteBudget,
  processBudgetAlerts,
} from "../../api/budgets.js";
import { ApiError } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import { formatApiError, formatPeriod } from "../../utils/budgetHelpers.js";
import "../../styles/properties.css";

export default function BudgetsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(location.state?.flash || "");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [alertsBusy, setAlertsBusy] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const filters = {
    search: searchParams.get("search") || "",
    periodType: searchParams.get("periodType") || "",
    year: searchParams.get("year") || "",
    page: Number(searchParams.get("page") || 1),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listBudgets({
        search: filters.search || undefined,
        periodType: filters.periodType || undefined,
        year: filters.year || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.periodType, filters.year, filters.page]);

  useEffect(() => {
    load();
  }, [load]);

  function updateFilters(patch) {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (!v) next.delete(k);
      else next.set(k, String(v));
    });
    if (!("page" in patch)) next.set("page", "1");
    setSearchParams(next);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBudget(deleteTarget.id);
      setDeleteTarget(null);
      setToast("Budget archived");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function runAlerts() {
    setAlertsBusy(true);
    setError("");
    try {
      const result = await processBudgetAlerts();
      setToast(
        `Alerts: ${result?.created ?? 0} created, ${result?.skipped ?? 0} skipped (${result?.scanned ?? 0} scanned)`
      );
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Alert process failed");
    } finally {
      setAlertsBusy(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Finance</p>
          <h2 className="page-toolbar__title">Budgets</h2>
        </div>
        <div className="page-toolbar__actions">
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            disabled={alertsBusy}
            onClick={runAlerts}
          >
            {alertsBusy ? "Processing…" : "Process overspend alerts"}
          </button>
          <Link to="/budgets/new" className="btn btn--primary btn--inline">
            Add budget
          </Link>
        </div>
      </div>

      {toast ? <div className="alert alert--success">{toast}</div> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      <div className="filters-row">
        <input
          type="search"
          placeholder="Search name…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateFilters({ search: searchInput });
          }}
        />
        <button
          type="button"
          className="btn btn--soft btn--inline"
          onClick={() => updateFilters({ search: searchInput })}
        >
          Search
        </button>
        <select
          value={filters.periodType}
          onChange={(e) => updateFilters({ periodType: e.target.value })}
        >
          <option value="">All periods</option>
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
        </select>
        <input
          type="number"
          placeholder="Year"
          value={filters.year}
          onChange={(e) => updateFilters({ year: e.target.value })}
          min="2000"
          max="2100"
          style={{ width: "6rem" }}
        />
      </div>

      {loading ? <p className="muted">Loading…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="muted">No budgets yet.</p>
      ) : null}

      {items.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Period</th>
                <th>Total</th>
                <th>Spent</th>
                <th>Used</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link to={`/budgets/${b.id}`}>{b.name}</Link>
                    {b.isOverAlert ? (
                      <span className="muted tiny"> · over alert</span>
                    ) : null}
                  </td>
                  <td>{formatPeriod(b)}</td>
                  <td>{formatMoney(b.totalAmount)}</td>
                  <td>{formatMoney(b.spentAmount)}</td>
                  <td>{b.utilizationPct}%</td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="btn btn--tiny"
                      onClick={() => navigate(`/budgets/${b.id}/edit`)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--tiny btn--danger-text"
                      onClick={() => setDeleteTarget(b)}
                    >
                      Archive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pagination.totalPages > 1 ? (
        <div className="pager">
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            disabled={filters.page <= 1}
            onClick={() => updateFilters({ page: filters.page - 1 })}
          >
            Previous
          </button>
          <span className="muted">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            disabled={filters.page >= pagination.totalPages}
            onClick={() => updateFilters({ page: filters.page + 1 })}
          >
            Next
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Archive budget?"
        message={
          deleteTarget
            ? `Move “${deleteTarget.name}” to the recycle bin?`
            : ""
        }
        confirmLabel="Archive"
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
