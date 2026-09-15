import { useCallback, useEffect, useState } from "react";
import { listPropertyHistory } from "../../api/properties.js";
import { ApiError } from "../../api/client.js";
import { formatLabel } from "../../utils/propertyHelpers.js";

const EVENT_FILTERS = [
  { value: "", label: "All events" },
  { value: "created", label: "Created" },
  { value: "price_update", label: "Price update" },
  { value: "ownership_change", label: "Ownership change" },
  { value: "status_change", label: "Status change" },
  { value: "commission_override", label: "Commission override" },
  { value: "transfer", label: "Transfer" },
  { value: "media_upload", label: "Media upload" },
  { value: "document_upload", label: "Document upload" },
  { value: "other", label: "Other" },
];

function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function summarizeValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return String(value);
  try {
    return JSON.stringify(value, null, 0);
  } catch {
    return String(value);
  }
}

export default function PropertyHistoryTimeline({ propertyId }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });
  const [eventType, setEventType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (page = 1) => {
      if (!propertyId) return;
      setLoading(true);
      setError("");
      try {
        const result = await listPropertyHistory(propertyId, {
          eventType: eventType || undefined,
          page,
          limit: 25,
        });
        setItems(result.items);
        setPagination(result.pagination);
      } catch (err) {
        setItems([]);
        setError(
          err instanceof ApiError ? err.message : "Failed to load property history"
        );
      } finally {
        setLoading(false);
      }
    },
    [propertyId, eventType]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <section className="detail-card">
      <div className="history-panel__header">
        <h3 className="detail-card__title">Property history</h3>
        <label className="history-filter">
          <span className="history-filter__label">Filter</span>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            disabled={loading}
            aria-label="Filter history by event type"
          >
            {EVENT_FILTERS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p className="muted">Loading history…</p> : null}
      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="muted">No history events recorded for this property yet.</p>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <ol className="history-timeline">
          {items.map((event) => (
            <li key={event.id} className="history-timeline__item">
              <div className="history-timeline__marker" aria-hidden="true" />
              <div className="history-timeline__body">
                <div className="history-timeline__meta">
                  <span
                    className={`history-badge history-badge--${event.eventType}`}
                  >
                    {formatLabel(event.eventType)}
                  </span>
                  <time dateTime={event.createdAt}>
                    {formatWhen(event.createdAt)}
                  </time>
                </div>
                <p className="history-timeline__desc">
                  {event.description || "Event recorded"}
                </p>
                <p className="history-timeline__actor muted tiny">
                  By {event.performedByName || "System / unknown"}
                </p>
                {(event.oldValue || event.newValue) && (
                  <details className="history-timeline__details">
                    <summary>Change details</summary>
                    {event.oldValue ? (
                      <p>
                        <strong>Before:</strong> {summarizeValue(event.oldValue)}
                      </p>
                    ) : null}
                    {event.newValue ? (
                      <p>
                        <strong>After:</strong> {summarizeValue(event.newValue)}
                      </p>
                    ) : null}
                  </details>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {pagination.totalPages > 1 ? (
        <div className="history-pagination">
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            disabled={loading || pagination.page <= 1}
            onClick={() => load(pagination.page - 1)}
          >
            Previous
          </button>
          <span className="muted tiny">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total}{" "}
            events)
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => load(pagination.page + 1)}
          >
            Next
          </button>
        </div>
      ) : null}

      <p className="muted tiny history-panel__note">
        Document and media registrations appear here as{" "}
        <code>document_upload</code> and <code>media_upload</code> events.
      </p>
    </section>
  );
}
