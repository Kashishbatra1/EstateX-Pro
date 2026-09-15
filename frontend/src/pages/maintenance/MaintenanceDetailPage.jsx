import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getMaintenance,
  deleteMaintenance,
  updateMaintenance,
} from "../../api/maintenance.js";
import { ApiError } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import {
  ErrorState,
  LoadingState,
} from "../../components/ui/PageStates.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  formatApiError,
  formatPriority,
  isOverdueDate,
} from "../../utils/maintenanceHelpers.js";
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

export default function MaintenanceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(location.state?.flash || "");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTask(await getMaintenance(id));
    } catch (err) {
      setTask(null);
      setError(err instanceof ApiError ? formatApiError(err) : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteMaintenance(id);
      navigate("/maintenance", { state: { flash: "Task archived" } });
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Delete failed");
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  async function setStatus(status, flash) {
    setBusy(true);
    setError("");
    try {
      setTask(await updateMaintenance(id, { status }));
      setToast(flash);
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <LoadingState message="Loading maintenance task…" />;
  }

  if (!task) {
    return (
      <div className="properties-page">
        <ErrorState
          message={error || "Task not found"}
          onRetry={load}
        />
        <Link to="/maintenance" className="btn btn--ghost btn--inline">
          Back to maintenance
        </Link>
      </div>
    );
  }

  const overdue =
    isOverdueDate(task.dueDate) &&
    task.status !== "completed" &&
    task.status !== "cancelled";
  const canComplete =
    task.status !== "completed" && task.status !== "cancelled";
  const canStart = task.status === "scheduled" || task.status === "overdue";

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/maintenance" className="crumb">
              Maintenance
            </Link>
            <span aria-hidden="true"> / </span>
            #{task.id}
          </p>
          <h2 className="page-toolbar__title">{task.title}</h2>
          <div className="detail-meta">
            <StatusBadge status={task.status} />
            <span
              className={`priority-pill priority-pill--${task.priority || "medium"}`}
            >
              {formatPriority(task.priority)}
            </span>
            {overdue ? <span className="pill-flag pill-flag--warn">Past due</span> : null}
          </div>
        </div>
        <div className="toolbar-actions">
          {canStart ? (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => setStatus("in_progress", "Marked in progress")}
            >
              Start work
            </button>
          ) : null}
          {canComplete ? (
            <button
              type="button"
              className="btn btn--primary btn--inline"
              disabled={busy}
              onClick={() => setStatus("completed", "Marked completed")}
            >
              Mark completed
            </button>
          ) : null}
          <Link to={`/maintenance/${id}/edit`} className="btn btn--ghost">
            Edit
          </Link>
          <button
            type="button"
            className="btn btn--danger-outline"
            onClick={() => setDeleteOpen(true)}
          >
            Archive
          </button>
        </div>
      </div>

      {toast ? (
        <div className="toast toast--success" role="status">
          {toast}
        </div>
      ) : null}
      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="detail-layout">
        <div className="detail-stack">
          <section className="detail-card">
            <h3 className="detail-card__title">Task details</h3>
            <dl className="detail-list">
              <DetailRow label="Title" value={task.title} />
              <DetailRow label="Category" value={task.category} />
              <DetailRow
                label="Description"
                value={task.description}
              />
              <DetailRow label="Notes" value={task.notes} />
            </dl>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Schedule & cost</h3>
            <dl className="detail-list detail-list--2">
              <DetailRow
                label="Due date"
                value={
                  overdue ? (
                    <span className="text-warn">{task.dueDate} (past due)</span>
                  ) : (
                    task.dueDate
                  )
                }
              />
              <DetailRow
                label="Reminder"
                value={`${task.reminderDaysBefore ?? 0} days before`}
              />
              <DetailRow
                label="Estimated cost"
                value={
                  task.estimatedCost != null
                    ? formatMoney(task.estimatedCost)
                    : null
                }
              />
              <DetailRow
                label="Actual cost"
                value={
                  task.actualCost != null ? formatMoney(task.actualCost) : null
                }
              />
              <DetailRow
                label="Completed at"
                value={
                  task.completedAt
                    ? new Date(task.completedAt).toLocaleString()
                    : null
                }
              />
            </dl>
          </section>
        </div>

        <aside className="detail-side">
          <section className="detail-card">
            <h3 className="detail-card__title">Property</h3>
            <dl className="detail-list">
              <DetailRow
                label="Property"
                value={
                  <Link to={`/properties/${task.propertyId}`} className="linkish">
                    {task.propertyTitle || `Property #${task.propertyId}`}
                  </Link>
                }
              />
              <DetailRow label="Code" value={task.propertyCode} />
            </dl>
            <div className="related-nav" style={{ marginTop: "0.75rem" }}>
              <Link
                to={`/properties/${task.propertyId}`}
                className="btn btn--ghost btn--inline"
              >
                Open property
              </Link>
              <Link
                to={`/maintenance?propertyId=${task.propertyId}`}
                className="btn btn--ghost btn--inline"
              >
                All tasks for property
              </Link>
            </div>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Assignment</h3>
            <dl className="detail-list">
              <DetailRow
                label="Assigned to"
                value={task.assignedToName}
              />
              <DetailRow
                label="Vendor"
                value={
                  task.vendorId ? (
                    <Link to={`/vendors/${task.vendorId}`} className="linkish">
                      {task.vendorName || `Vendor #${task.vendorId}`}
                    </Link>
                  ) : null
                }
              />
              <DetailRow
                label="Priority"
                value={formatPriority(task.priority)}
              />
              <DetailRow
                label="Status"
                value={<StatusBadge status={task.status} />}
              />
            </dl>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Archive task?"
        message={`“${task.title}” will be soft-deleted and moved to the recycle bin.`}
        confirmLabel="Archive"
        danger
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
