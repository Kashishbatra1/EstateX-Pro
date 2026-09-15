import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getRecurring, deleteRecurring } from "../../api/recurring.js";
import { ApiError } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  formatApiError,
  formatFrequency,
} from "../../utils/recurringHelpers.js";
import "../../styles/properties.css";

function Row({ label, value }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value == null || value === "" ? "—" : value}</dd>
    </div>
  );
}

export default function RecurringDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItem(await getRecurring(id));
    } catch (err) {
      setItem(null);
      setError(err instanceof ApiError ? formatApiError(err) : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="muted">Loading recurring expense…</p>;
  if (!item) {
    return (
      <div className="state-panel state-panel--error">
        {error || "Not found"}
        <Link to="/recurring">Back</Link>
      </div>
    );
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/recurring" className="crumb">
              Recurring
            </Link>
          </p>
          <h2 className="page-toolbar__title">{item.title}</h2>
          {!item.isActive ? <span className="pill-flag">Inactive</span> : null}
          {item.autoDebitFlag ? (
            <span className="pill-flag" style={{ marginLeft: 6 }}>
              Auto-debit
            </span>
          ) : null}
        </div>
        <div className="toolbar-actions">
          <Link to={`/recurring/${id}/edit`} className="btn btn--ghost">
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

      {flash ? <div className="alert alert--success">{flash}</div> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      <div className="detail-layout">
        <div className="detail-stack">
          <section className="detail-card">
            <h3 className="detail-card__title">Schedule</h3>
            <dl className="detail-list detail-list--2">
              <Row label="Amount" value={formatMoney(item.amount)} />
              <Row label="Frequency" value={formatFrequency(item.frequency)} />
              <Row label="Due day" value={item.dueDay} />
              <Row label="Next due" value={item.nextDueDate} />
              <Row label="Remind days before" value={item.reminderDaysBefore} />
              <Row
                label="Annual escalation"
                value={`${item.annualEscalationPct}%`}
              />
              <Row label="Status" value={item.isActive ? "Active" : "Inactive"} />
              <Row
                label="Auto-debit"
                value={item.autoDebitFlag ? "Yes" : "No"}
              />
            </dl>
          </section>
          <section className="detail-card">
            <h3 className="detail-card__title">Links & notes</h3>
            <dl className="detail-list detail-list--2">
              <Row
                label="Category"
                value={
                  item.categoryName
                    ? `${item.categoryName} (#${item.categoryId})`
                    : item.categoryId
                }
              />
              <Row
                label="Vendor"
                value={
                  item.vendorName
                    ? `${item.vendorName} (#${item.vendorId})`
                    : item.vendorId
                }
              />
              <Row label="Notes" value={item.notes} />
            </dl>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Archive recurring expense?"
        message={`"${item.title}" will be soft-deleted.`}
        confirmLabel="Archive"
        danger
        loading={busy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteRecurring(id);
            navigate("/recurring", {
              state: { flash: "Recurring expense archived" },
            });
          } catch (err) {
            setError(err instanceof ApiError ? formatApiError(err) : "Archive failed");
            setDeleteOpen(false);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
