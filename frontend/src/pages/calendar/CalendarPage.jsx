import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCalendar } from "../../api/favorites.js";
import { listProperties, createPropertyVisit } from "../../api/properties.js";
import { listClients } from "../../api/clients.js";
import { ApiError } from "../../api/client.js";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/ui/PageStates.jsx";
import "../../styles/properties.css";

const PRIMARY_EVENT_TYPES = [
  { id: "property_visit", label: "Property Visits" },
  { id: "booking_date", label: "Booking Dates" },
  { id: "installment_due", label: "Installment Dates" },
  { id: "payment_schedule", label: "Payment Schedule" },
  { id: "contract_date", label: "Contract Dates", apiTypes: ["contract_date", "vendor_contract_renewal"] },
  { id: "booking_expiry", label: "Booking Expiry" },
  { id: "client_follow_up", label: "Client Follow-ups" },
];

const EXTRA_EVENT_TYPES = [
  { id: "transfer", label: "Transfers" },
  { id: "maintenance", label: "Maintenance" },
  { id: "document_expiry", label: "Document Expiry" },
];

function monthBounds(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  const from = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { from, to };
}

function formatEventType(type) {
  if (type === "vendor_contract_renewal") return "Contract Dates";
  const found = [...PRIMARY_EVENT_TYPES, ...EXTRA_EVENT_TYPES].find(
    (t) => t.id === type
  );
  if (found) return found.label;
  if (!type) return "";
  return String(type)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function eventBadgeClass(type) {
  switch (type) {
    case "property_visit":
      return "cal-badge cal-badge--visit";
    case "booking_date":
      return "cal-badge cal-badge--booking";
    case "installment_due":
    case "payment_schedule":
      return "cal-badge cal-badge--pay";
    case "contract_date":
    case "vendor_contract_renewal":
      return "cal-badge cal-badge--contract";
    case "booking_expiry":
      return "cal-badge cal-badge--expiry";
    case "client_follow_up":
      return "cal-badge cal-badge--follow";
    default:
      return "cal-badge";
  }
}

export default function CalendarPage() {
  const initial = useMemo(() => monthBounds(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [activeTypes, setActiveTypes] = useState(() =>
    PRIMARY_EVENT_TYPES.map((t) => t.id)
  );
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [properties, setProperties] = useState([]);
  const [clients, setClients] = useState([]);
  const [visitForm, setVisitForm] = useState({
    propertyId: "",
    clientId: "",
    visitDate: initial.from,
    visitTime: "",
    notes: "",
  });
  const [visitBusy, setVisitBusy] = useState(false);
  const [visitMsg, setVisitMsg] = useState("");
  const [visitErr, setVisitErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { from, to };
      const allTypes = [...PRIMARY_EVENT_TYPES, ...EXTRA_EVENT_TYPES];
      if (
        activeTypes.length &&
        activeTypes.length < allTypes.length
      ) {
        const expanded = [];
        for (const id of activeTypes) {
          const meta = allTypes.find((t) => t.id === id);
          if (meta?.apiTypes) expanded.push(...meta.apiTypes);
          else expanded.push(id);
        }
        params.eventType = [...new Set(expanded)].join(",");
      }
      const data = await fetchCalendar(params);
      setItems(data.items || []);
    } catch (err) {
      setItems([]);
      setError(err instanceof ApiError ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [from, to, activeTypes]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listProperties({ limit: 100 }).catch(() => ({ items: [] })),
      listClients({ limit: 100 }).catch(() => ({ items: [] })),
    ]).then(([propsRes, clientsRes]) => {
      if (cancelled) return;
      setProperties(propsRes.items || []);
      setClients(clientsRes.items || []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function setThisMonth() {
    const bounds = monthBounds(new Date());
    setFrom(bounds.from);
    setTo(bounds.to);
  }

  function toggleType(id) {
    setActiveTypes((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== id);
      }
      return [...prev, id];
    });
  }

  function selectPrimaryOnly() {
    setActiveTypes(PRIMARY_EVENT_TYPES.map((t) => t.id));
  }

  async function handleScheduleVisit(event) {
    event.preventDefault();
    setVisitErr("");
    setVisitMsg("");
    if (!visitForm.propertyId || !visitForm.visitDate) {
      setVisitErr("Property and visit date are required");
      return;
    }
    setVisitBusy(true);
    try {
      await createPropertyVisit(visitForm.propertyId, {
        clientId: visitForm.clientId || null,
        visitDate: visitForm.visitDate,
        visitTime: visitForm.visitTime || null,
        notes: visitForm.notes || null,
      });
      setVisitMsg("Visit scheduled");
      setVisitForm((v) => ({ ...v, notes: "", visitTime: "" }));
      await load();
    } catch (err) {
      setVisitErr(
        err instanceof ApiError ? err.message : "Could not schedule visit"
      );
    } finally {
      setVisitBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map();
    for (const ev of items) {
      const key = ev.date || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Workspace</p>
          <h2 className="page-toolbar__title">Booking Calendar</h2>
          <p className="muted tiny" style={{ marginTop: "0.35rem" }}>
            Property visits, payment schedules, contract dates, booking &amp;
            installment dates, booking expiry, and client follow-ups.
          </p>
        </div>
        <div className="page-toolbar__actions">
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            onClick={setThisMonth}
          >
            This month
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            onClick={selectPrimaryOnly}
          >
            Core events
          </button>
        </div>
      </div>

      <form
        className="filters-bar filters-bar--calendar"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="submit" className="btn btn--primary btn--inline">
          Refresh
        </button>
      </form>

      <div className="cal-type-filters" role="group" aria-label="Event types">
        {[...PRIMARY_EVENT_TYPES, ...EXTRA_EVENT_TYPES].map((t) => {
          const on = activeTypes.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              className={`cal-type-chip${on ? " is-on" : ""}`}
              aria-pressed={on}
              onClick={() => toggleType(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <section className="detail-card" style={{ marginBottom: "1.25rem" }}>
        <h3 className="detail-card__title">Schedule property visit</h3>
        <form className="form-grid" onSubmit={handleScheduleVisit}>
          <label className="field">
            <span className="field__label">Property *</span>
            <select
              value={visitForm.propertyId}
              onChange={(e) =>
                setVisitForm((v) => ({ ...v, propertyId: e.target.value }))
              }
              disabled={visitBusy}
            >
              <option value="">Select…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.propertyCode ? `${p.propertyCode} — ` : ""}
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Client</span>
            <select
              value={visitForm.clientId}
              onChange={(e) =>
                setVisitForm((v) => ({ ...v, clientId: e.target.value }))
              }
              disabled={visitBusy}
            >
              <option value="">Optional…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.clientName || c.name || `Client #${c.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Visit date *</span>
            <input
              type="date"
              value={visitForm.visitDate}
              onChange={(e) =>
                setVisitForm((v) => ({ ...v, visitDate: e.target.value }))
              }
              disabled={visitBusy}
            />
          </label>
          <label className="field">
            <span className="field__label">Time</span>
            <input
              type="time"
              value={visitForm.visitTime}
              onChange={(e) =>
                setVisitForm((v) => ({ ...v, visitTime: e.target.value }))
              }
              disabled={visitBusy}
            />
          </label>
          <label className="field form-grid__full">
            <span className="field__label">Notes</span>
            <input
              value={visitForm.notes}
              onChange={(e) =>
                setVisitForm((v) => ({ ...v, notes: e.target.value }))
              }
              disabled={visitBusy}
              placeholder="Optional notes"
            />
          </label>
          <div className="form-grid__full">
            <button
              type="submit"
              className="btn btn--primary btn--inline"
              disabled={visitBusy}
            >
              {visitBusy ? "Scheduling…" : "Schedule visit"}
            </button>
            {visitMsg ? (
              <span className="muted tiny" style={{ marginLeft: "0.75rem" }}>
                {visitMsg}
              </span>
            ) : null}
            {visitErr ? (
              <div className="alert alert--error" style={{ marginTop: "0.75rem" }}>
                {visitErr}
              </div>
            ) : null}
          </div>
        </form>
      </section>

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? <LoadingState message="Loading events…" /> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No events in this range"
          message="Try another date range, enable more event types, or schedule a property visit above."
          actionLabel="Open bookings"
          actionTo="/bookings"
        />
      ) : null}

      {!loading && grouped.length > 0 ? (
        <div className="cal-day-groups">
          {grouped.map(([date, dayItems]) => (
            <section key={date} className="cal-day">
              <h3 className="cal-day__title">{date}</h3>
              <ul className="docs-list">
                {dayItems.map((ev) => (
                  <li key={ev.id} className="docs-list__item">
                    <div>
                      <span className={eventBadgeClass(ev.eventType)}>
                        {formatEventType(ev.eventType)}
                      </span>
                      <strong style={{ marginLeft: "0.5rem" }}>{ev.title}</strong>
                      {ev.subtitle ? (
                        <div className="muted tiny">{ev.subtitle}</div>
                      ) : null}
                    </div>
                    {ev.path ? (
                      <Link to={ev.path} className="btn btn--tiny btn--ghost">
                        Open
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
