import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  listRecurring,
  deleteRecurring,
  processRecurringReminders,
} from "../../api/recurring.js";
import { ApiError } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  formatApiError,
  formatFrequency,
  FREQUENCIES,
} from "../../utils/recurringHelpers.js";
import "../../styles/properties.css";

export default function RecurringExpensesPage() {
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
  const [remindersBusy, setRemindersBusy] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const filters = {
    search: searchParams.get("search") || "",
    frequency: searchParams.get("frequency") || "",
    active: searchParams.get("active") || "",
    dueSoon: searchParams.get("dueSoon") || "",
    page: Number(searchParams.get("page") || 1),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listRecurring({
        search: filters.search || undefined,
        frequency: filters.frequency || undefined,
        active: filters.active || undefined,
        dueSoon: filters.dueSoon || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError ? formatApiError(err) : "Failed to load recurring expenses"
      );
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.frequency, filters.active, filters.dueSoon, filters.page]);

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
      await deleteRecurring(deleteTarget.id);
      setDeleteTarget(null);
      setToast("Recurring expense archived");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function runReminders() {
    setRemindersBusy(true);
    setError("");
    try {
      const result = await processRecurringReminders();
      setToast(
        `Reminders: ${result?.created ?? 0} created, ${result?.skipped ?? 0} skipped (${result?.scanned ?? 0} due soon)`
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? formatApiError(err) : "Failed to process reminders"
      );
    } finally {
      setRemindersBusy(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Office</p>
          <h2 className="page-toolbar__title">Recurring expenses</h2>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            onClick={runReminders}
            disabled={remindersBusy}
          >
            {remindersBusy ? "Processing…" : "Send due reminders"}
          </button>
          <Link to="/recurring/new" className="btn btn--primary btn--inline">
            Add recurring
          </Link>
        </div>
      </div>
      {toast ? <div className="alert alert--success">{toast}</div> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      <form
        className="filters-bar"
        onSubmit={(e) => {
          e.preventDefault();
          updateFilters({ search: searchInput.trim() });
        }}
      >
        <input
          className="filters-bar__search"
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search recurring…"
        />
        <select
          value={filters.frequency}
          onChange={(e) => updateFilters({ frequency: e.target.value })}
        >
          <option value="">All frequencies</option>
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {formatFrequency(f)}
            </option>
          ))}
        </select>
        <select
          value={filters.active}
          onChange={(e) => updateFilters({ active: e.target.value })}
        >
          <option value="">Active & inactive</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
        <select
          value={filters.dueSoon}
          onChange={(e) => updateFilters({ dueSoon: e.target.value })}
        >
          <option value="">Any due date</option>
          <option value="true">Due soon</option>
        </select>
        <button type="submit" className="btn btn--soft btn--inline">
          Search
        </button>
      </form>

      {loading ? <p className="muted">Loading recurring expenses…</p> : null}
      {!loading && items.length === 0 ? (
        <div className="state-panel">
          <p>No recurring expenses found.</p>
          <Link to="/recurring/new" className="btn btn--primary btn--inline">
            Add recurring
          </Link>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Amount</th>
                <th>Frequency</th>
                <th>Next due</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="clickable-row"
                  onClick={() => navigate(`/recurring/${item.id}`)}
                >
                  <td>
                    <strong>{item.title}</strong>
                    {item.autoDebitFlag ? (
                      <span className="pill-flag" style={{ marginLeft: 6 }}>
                        Auto-debit
                      </span>
                    ) : null}
                    <div className="muted tiny">
                      {item.categoryName || item.vendorName || ""}
                    </div>
                  </td>
                  <td>{formatMoney(item.amount)}</td>
                  <td>{formatFrequency(item.frequency)}</td>
                  <td>{item.nextDueDate || "—"}</td>
                  <td>{item.isActive ? "Active" : "Inactive"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--tiny btn--danger-text"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(item);
                      }}
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
        <div className="history-pagination">
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            disabled={pagination.page <= 1}
            onClick={() => updateFilters({ page: pagination.page - 1 })}
          >
            Previous
          </button>
          <span className="muted tiny">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => updateFilters({ page: pagination.page + 1 })}
          >
            Next
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Archive recurring expense?"
        message={deleteTarget ? `"${deleteTarget.title}" will be soft-deleted.` : ""}
        confirmLabel="Archive"
        danger
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
