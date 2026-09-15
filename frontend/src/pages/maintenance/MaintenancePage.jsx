import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  listMaintenance,
  deleteMaintenance,
  processMaintenanceReminders,
} from "../../api/maintenance.js";
import { ApiError } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/ui/PageStates.jsx";
import {
  STATUSES,
  PRIORITIES,
  formatApiError,
  formatPriority,
  isOverdueDate,
} from "../../utils/maintenanceHelpers.js";
import "../../styles/properties.css";

export default function MaintenancePage() {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(location.state?.flash || "");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [remindersBusy, setRemindersBusy] = useState(false);
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || ""
  );

  const filters = {
    search: searchParams.get("search") || "",
    status: searchParams.get("status") || "",
    priority: searchParams.get("priority") || "",
    dueSoon: searchParams.get("dueSoon") || "",
    propertyId: searchParams.get("propertyId") || "",
    page: Number(searchParams.get("page") || 1),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listMaintenance({
        search: filters.search || undefined,
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        dueSoon: filters.dueSoon || undefined,
        propertyId: filters.propertyId || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setItems([]);
      setError(
        err instanceof ApiError ? formatApiError(err) : "Failed to load tasks"
      );
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.status,
    filters.priority,
    filters.dueSoon,
    filters.propertyId,
    filters.page,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setSearchInput(searchParams.get("search") || "");
  }, [searchParams]);

  function updateFilters(patch) {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") next.delete(k);
      else next.set(k, String(v));
    });
    if (!("page" in patch)) next.set("page", "1");
    setSearchParams(next);
  }

  function clearFilters() {
    setSearchInput("");
    setSearchParams({});
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMaintenance(deleteTarget.id);
      setDeleteTarget(null);
      setToast("Task archived");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Delete failed");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  async function runReminders() {
    setRemindersBusy(true);
    setError("");
    try {
      const result = await processMaintenanceReminders();
      setToast(
        `Reminders processed: ${result?.created ?? 0} created, ${result?.skipped ?? 0} skipped`
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? formatApiError(err) : "Reminders failed"
      );
    } finally {
      setRemindersBusy(false);
    }
  }

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.status ||
      filters.priority ||
      filters.dueSoon ||
      filters.propertyId
  );

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Property</p>
          <h2 className="page-toolbar__title">Maintenance</h2>
          <p className="muted tiny" style={{ marginTop: "0.35rem" }}>
            Schedule property work, track deadlines, and follow vendor assignments.
          </p>
        </div>
        <div className="page-toolbar__actions">
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            disabled={remindersBusy || loading}
            onClick={runReminders}
          >
            {remindersBusy ? "Processing…" : "Process reminders"}
          </button>
          <Link to="/maintenance/new" className="btn btn--primary btn--inline">
            Add task
          </Link>
        </div>
      </div>

      {toast ? (
        <div className="toast toast--success" role="status">
          {toast}
        </div>
      ) : null}

      <form
        className="filters-bar filters-bar--maintenance"
        onSubmit={(e) => {
          e.preventDefault();
          updateFilters({ search: searchInput.trim() });
        }}
      >
        <input
          className="filters-bar__search"
          type="search"
          placeholder="Search title, category, notes…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search maintenance tasks"
        />
        <select
          value={filters.status}
          onChange={(e) => updateFilters({ status: e.target.value })}
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={filters.priority}
          onChange={(e) => updateFilters({ priority: e.target.value })}
          aria-label="Priority"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {formatPriority(p)}
            </option>
          ))}
        </select>
        <select
          value={filters.dueSoon}
          onChange={(e) => updateFilters({ dueSoon: e.target.value })}
          aria-label="Due date filter"
        >
          <option value="">Any due date</option>
          <option value="true">Due soon</option>
        </select>
        <button type="submit" className="btn btn--soft btn--inline">
          Search
        </button>
        {hasActiveFilters ? (
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            onClick={clearFilters}
          >
            Clear
          </button>
        ) : null}
      </form>

      {filters.propertyId ? (
        <p className="muted tiny">
          Filtered to property #{filters.propertyId}.{" "}
          <button
            type="button"
            className="btn btn--tiny btn--ghost"
            onClick={() => updateFilters({ propertyId: "" })}
          >
            Clear property filter
          </button>
        </p>
      ) : null}

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? <LoadingState message="Loading maintenance tasks…" /> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No maintenance tasks"
          message={
            hasActiveFilters
              ? "No tasks match these filters. Try clearing filters or creating a new task."
              : "Track repairs, inspections, and property work from here."
          }
          actionLabel="Add first task"
          actionTo="/maintenance/new"
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Property</th>
                <th>Due</th>
                <th>Status</th>
                <th>Priority</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((t) => {
                const overdue =
                  isOverdueDate(t.dueDate) &&
                  t.status !== "completed" &&
                  t.status !== "cancelled";
                return (
                  <tr
                    key={t.id}
                    className="clickable-row"
                    onClick={() => navigate(`/maintenance/${t.id}`)}
                  >
                    <td>
                      <strong>{t.title}</strong>
                      {t.category ? (
                        <div className="muted tiny">{t.category}</div>
                      ) : null}
                    </td>
                    <td>
                      {t.propertyTitle || `Property #${t.propertyId}`}
                      {t.propertyCode ? (
                        <div className="muted tiny">{t.propertyCode}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={overdue ? "text-warn" : undefined}>
                        {t.dueDate || "—"}
                      </span>
                      {overdue ? (
                        <div className="muted tiny">Past due</div>
                      ) : null}
                    </td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>
                      <span
                        className={`priority-pill priority-pill--${t.priority || "medium"}`}
                      >
                        {formatPriority(t.priority)}
                      </span>
                    </td>
                    <td>
                      <div className="docs-list__actions">
                        <button
                          type="button"
                          className="btn btn--tiny btn--ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/maintenance/${t.id}/edit`);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn--tiny btn--danger-text"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(t);
                          }}
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
            {pagination.total ? ` · ${pagination.total} tasks` : ""}
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
        title="Archive task?"
        message={
          deleteTarget
            ? `“${deleteTarget.title}” will be soft-deleted and moved to the recycle bin.`
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
