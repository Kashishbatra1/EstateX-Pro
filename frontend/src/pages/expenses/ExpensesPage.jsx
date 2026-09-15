import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listExpenses, deleteExpense } from "../../api/expenses.js";
import { listProperties } from "../../api/properties.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  APPROVAL_STATUSES,
  formatLabel,
  formatApiError,
  collectLookupsFromExpenses,
} from "../../utils/expenseHelpers.js";
import "../../styles/properties.css";

export default function ExpensesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [properties, setProperties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || ""
  );

  const filters = {
    search: searchParams.get("search") || "",
    approvalStatus: searchParams.get("approvalStatus") || "",
    categoryId: searchParams.get("categoryId") || "",
    propertyId: searchParams.get("propertyId") || "",
    vendorId: searchParams.get("vendorId") || "",
    expenseFrom: searchParams.get("expenseFrom") || "",
    expenseTo: searchParams.get("expenseTo") || "",
    page: Number(searchParams.get("page") || 1),
  };

  useEffect(() => {
    listProperties({ limit: 100 })
      .then((res) => setProperties(res.items || []))
      .catch(() => setProperties([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listExpenses({
        search: filters.search || undefined,
        approvalStatus: filters.approvalStatus || undefined,
        categoryId: filters.categoryId || undefined,
        propertyId: filters.propertyId || undefined,
        vendorId: filters.vendorId || undefined,
        expenseFrom: filters.expenseFrom || undefined,
        expenseTo: filters.expenseTo || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setPagination(data.pagination);
      const lookups = collectLookupsFromExpenses(data.items);
      if (lookups.categories.length) {
        setCategories((prev) => {
          const map = new Map(prev.map((c) => [c.id, c]));
          lookups.categories.forEach((c) => map.set(c.id, c));
          return Array.from(map.values());
        });
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? formatApiError(err) : "Failed to load expenses"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.approvalStatus,
    filters.categoryId,
    filters.propertyId,
    filters.vendorId,
    filters.expenseFrom,
    filters.expenseTo,
    filters.page,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSearchInput(searchParams.get("search") || "");
  }, [searchParams]);

  useEffect(() => {
    const flash = location.state?.flash;
    if (flash) {
      setToast(flash);
      navigate(location.pathname + location.search, {
        replace: true,
        state: {},
      });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  function updateFilters(next) {
    const merged = { ...filters, ...next, page: next.page ?? 1 };
    const params = {};
    Object.entries(merged).forEach(([key, value]) => {
      if (key === "page" && Number(value) <= 1) return;
      if (value !== "" && value !== null && value !== undefined) {
        params[key] = String(value);
      }
    });
    setSearchParams(params);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    updateFilters({ search: searchInput.trim(), page: 1 });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteTarget.id);
      setToast(`Expense ${deleteTarget.expenseCode} moved to recycle bin`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? formatApiError(err) : "Archive failed"
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Operations</p>
          <h2 className="page-toolbar__title">Expenses</h2>
        </div>
        <Link to="/expenses/new" className="btn btn--primary btn--inline">
          Add Expense
        </Link>
      </div>

      {toast ? <div className="toast toast--success">{toast}</div> : null}

      <form
        className="filters-bar filters-bar--expenses"
        onSubmit={handleSearchSubmit}
      >
        <input
          className="filters-bar__search"
          type="search"
          placeholder="Search code, description, device…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={filters.approvalStatus}
          onChange={(e) => updateFilters({ approvalStatus: e.target.value })}
          aria-label="Filter by approval"
        >
          <option value="">All approvals</option>
          {APPROVAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatLabel(s)}
            </option>
          ))}
        </select>
        <select
          value={filters.categoryId}
          onChange={(e) => updateFilters({ categoryId: e.target.value })}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filters.propertyId}
          onChange={(e) => updateFilters({ propertyId: e.target.value })}
          aria-label="Filter by property"
        >
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.propertyCode || `#${p.id}`} — {p.title}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.expenseFrom}
          onChange={(e) => updateFilters({ expenseFrom: e.target.value })}
          aria-label="From date"
        />
        <input
          type="date"
          value={filters.expenseTo}
          onChange={(e) => updateFilters({ expenseTo: e.target.value })}
          aria-label="To date"
        />
        <button type="submit" className="btn btn--soft">
          Search
        </button>
      </form>

      {loading ? (
        <div className="state-panel">
          <div className="spinner" aria-hidden="true" />
          <p>Loading expenses…</p>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="state-panel state-panel--error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--ghost" onClick={load}>
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="state-panel">
          <p>No expenses match your filters.</p>
          <Link to="/expenses/new" className="btn btn--primary btn--inline">
            Add the first expense
          </Link>
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Paid by</th>
                  <th>Approval</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((expense) => (
                  <tr key={expense.id}>
                    <td className="mono">
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => navigate(`/expenses/${expense.id}`)}
                      >
                        {expense.expenseCode || `#${expense.id}`}
                      </button>
                    </td>
                    <td>
                      {expense.expenseDate
                        ? String(expense.expenseDate).slice(0, 10)
                        : "—"}
                    </td>
                    <td>
                      <div>{expense.categoryName || "—"}</div>
                      <div className="muted tiny">
                        {expense.subcategoryName || ""}
                      </div>
                    </td>
                    <td>
                      <div>{expense.description || "—"}</div>
                      {expense.propertyCode ? (
                        <div className="muted tiny mono">
                          {expense.propertyCode}
                        </div>
                      ) : null}
                    </td>
                    <td>{formatMoney(expense.amount)}</td>
                    <td>{expense.paidByEmployeeName || "—"}</td>
                    <td>
                      <StatusBadge status={expense.approvalStatus} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => navigate(`/expenses/${expense.id}`)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn--tiny btn--danger-text"
                          onClick={() => setDeleteTarget(expense)}
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span className="muted">
              {pagination.total} expense{pagination.total === 1 ? "" : "s"}
            </span>
            <div className="pagination__controls">
              <button
                type="button"
                className="btn btn--ghost"
                disabled={filters.page <= 1}
                onClick={() => updateFilters({ page: filters.page - 1 })}
              >
                Previous
              </button>
              <span>
                Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
              </span>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={filters.page >= pagination.totalPages}
                onClick={() => updateFilters({ page: filters.page + 1 })}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Archive expense?"
        message={
          deleteTarget
            ? `"${deleteTarget.expenseCode}" will be soft-deleted and moved to the recycle bin.`
            : ""
        }
        confirmLabel="Archive"
        danger
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
