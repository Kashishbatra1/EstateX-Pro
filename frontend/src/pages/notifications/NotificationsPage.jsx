import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  listNotifications,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  deleteNotification,
  processReminders,
  emitNotificationsChanged,
} from "../../api/notifications.js";
import { ApiError } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import {
  NOTIFICATION_TYPES,
  formatLabel,
  formatApiError,
  formatRelativeTime,
  resolveNotificationLink,
} from "../../utils/notificationHelpers.js";
import "../../styles/properties.css";
import "../../styles/notifications.css";

export default function NotificationsPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(location.state?.flash || "");
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [processingReminders, setProcessingReminders] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const filters = {
    isRead: searchParams.get("isRead") || "",
    notificationType: searchParams.get("notificationType") || "",
    page: Number(searchParams.get("page") || 1),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listNotifications({
        isRead: filters.isRead === "" ? undefined : filters.isRead,
        notificationType: filters.notificationType || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setUnreadCount(data.unreadCount);
      setPagination(data.pagination);
    } catch (err) {
      setItems([]);
      setError(
        err instanceof ApiError
          ? formatApiError(err)
          : "Failed to load notifications"
      );
    } finally {
      setLoading(false);
    }
  }, [filters.isRead, filters.notificationType, filters.page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  function updateFilters(patch) {
    const next = { ...filters, ...patch, page: patch.page ?? 1 };
    const params = {};
    Object.entries(next).forEach(([key, value]) => {
      if (key === "page" && Number(value) <= 1) return;
      if (value !== "" && value !== null && value !== undefined) {
        params[key] = String(value);
      }
    });
    setSearchParams(params);
  }

  async function handleMarkRead(item) {
    setBusyId(item.id);
    setError("");
    try {
      const updated = await markNotificationRead(item.id);
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? updated || { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - (item.isRead ? 0 : 1)));
      emitNotificationsChanged();
    } catch (err) {
      setError(
        err instanceof ApiError ? formatApiError(err) : "Could not mark as read"
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkUnread(item) {
    setBusyId(item.id);
    setError("");
    try {
      const updated = await markNotificationUnread(item.id);
      setItems((prev) =>
        prev.map((n) =>
          n.id === item.id ? updated || { ...n, isRead: false } : n
        )
      );
      setUnreadCount((c) => c + (item.isRead ? 1 : 0));
      emitNotificationsChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiError(err)
          : "Could not mark as unread"
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkAll() {
    setMarkingAll(true);
    setError("");
    try {
      const result = await markAllNotificationsRead();
      setToast(
        result.updatedCount
          ? `Marked ${result.updatedCount} notification(s) as read`
          : "No unread notifications"
      );
      await load();
      emitNotificationsChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiError(err)
          : "Could not mark all as read"
      );
    } finally {
      setMarkingAll(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    try {
      await deleteNotification(deleteTarget.id);
      setToast("Notification deleted");
      setDeleteTarget(null);
      await load();
      emitNotificationsChanged();
    } catch (err) {
      setError(
        err instanceof ApiError ? formatApiError(err) : "Delete failed"
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleProcessReminders() {
    setProcessingReminders(true);
    setError("");
    try {
      const result = await processReminders(7);
      setToast(
        result.createdCount
          ? `Created ${result.createdCount} reminder notification(s)`
          : "No new reminders to create"
      );
      await load();
      emitNotificationsChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiError(err)
          : "Could not process reminders"
      );
    } finally {
      setProcessingReminders(false);
    }
  }

  return (
    <div className="properties-page notifications-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Alerts</p>
          <h2 className="page-toolbar__title">Notifications</h2>
          <p className="muted">
            {!error
              ? `${unreadCount} unread · Process reminders covers bookings, installments, documents & vendor contracts`
              : "Could not load unread count"}
          </p>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            disabled={processingReminders || loading}
            onClick={handleProcessReminders}
          >
            {processingReminders ? "Processing…" : "Process reminders"}
          </button>
          <button
            type="button"
            className="btn btn--primary btn--inline"
            disabled={markingAll || loading || unreadCount === 0}
            onClick={handleMarkAll}
          >
            {markingAll ? "Updating…" : "Mark all read"}
          </button>
        </div>
      </div>

      {toast ? <div className="toast toast--success">{toast}</div> : null}

      <form
        className="filters-bar filters-bar--notifications"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <select
          value={filters.isRead}
          onChange={(e) => updateFilters({ isRead: e.target.value })}
          aria-label="Read filter"
        >
          <option value="">All</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
        <select
          value={filters.notificationType}
          onChange={(e) =>
            updateFilters({ notificationType: e.target.value })
          }
          aria-label="Type filter"
        >
          <option value="">All types</option>
          {NOTIFICATION_TYPES.map((t) => (
            <option key={t} value={t}>
              {formatLabel(t)}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn--ghost">
          Refresh
        </button>
      </form>

      {loading ? (
        <div className="state-panel">
          <div className="spinner" aria-hidden="true" />
          <p>Loading notifications…</p>
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
          <p>No notifications match your filters.</p>
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <ul className="notification-list">
            {items.map((item) => {
              const link = resolveNotificationLink(item);
              const busy = busyId === item.id;
              return (
                <li
                  key={item.id}
                  className={`notification-card${
                    item.isRead ? "" : " notification-card--unread"
                  }`}
                >
                  <div className="notification-card__main">
                    <div className="notification-card__meta">
                      <span className="notification-type">
                        {formatLabel(item.notificationType)}
                      </span>
                      <span className="muted tiny">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                      {!item.isRead ? (
                        <span className="notification-pill">Unread</span>
                      ) : null}
                    </div>
                    <h3 className="notification-card__title">{item.title}</h3>
                    <p className="notification-card__message">{item.message}</p>
                    {item.entityType ? (
                      <p className="muted tiny">
                        Related: {formatLabel(item.entityType)}
                        {item.entityId != null ? ` #${item.entityId}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="notification-card__actions">
                    {link ? (
                      <Link to={link.to} className="btn btn--tiny">
                        {link.label}
                      </Link>
                    ) : null}
                    {item.isRead ? (
                      <button
                        type="button"
                        className="btn btn--tiny"
                        disabled={busy}
                        onClick={() => handleMarkUnread(item)}
                      >
                        Mark unread
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--tiny"
                        disabled={busy}
                        onClick={() => handleMarkRead(item)}
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--tiny btn--danger-text"
                      disabled={busy}
                      onClick={() => setDeleteTarget(item)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="pagination">
            <span className="muted">
              {pagination.total} notification
              {pagination.total === 1 ? "" : "s"}
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
        title="Delete notification?"
        message={
          deleteTarget
            ? `"${deleteTarget.title}" will be permanently deleted.`
            : ""
        }
        confirmLabel="Delete"
        danger
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
