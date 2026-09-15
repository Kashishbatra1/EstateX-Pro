import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listPropertyVisits,
  createPropertyVisit,
  deletePropertyVisit,
} from "../../api/properties.js";
import { listClients } from "../../api/clients.js";
import { ApiError } from "../../api/client.js";

export default function PropertyVisitsPanel({ propertyId }) {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    visitDate: new Date().toISOString().slice(0, 10),
    visitTime: "",
    notes: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [visits, clientsRes] = await Promise.all([
        listPropertyVisits(propertyId),
        listClients({ limit: 100 }).catch(() => ({ items: [] })),
      ]);
      setItems(visits);
      setClients(clientsRes.items || []);
    } catch (err) {
      setItems([]);
      setError(err instanceof ApiError ? err.message : "Failed to load visits");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [propertyId]);

  async function handleCreate(event) {
    event.preventDefault();
    if (!form.visitDate) {
      setError("Visit date is required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createPropertyVisit(propertyId, {
        clientId: form.clientId || null,
        visitDate: form.visitDate,
        visitTime: form.visitTime || null,
        notes: form.notes || null,
      });
      setForm((f) => ({ ...f, notes: "", visitTime: "" }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not schedule visit");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(visitId) {
    setBusy(true);
    setError("");
    try {
      await deletePropertyVisit(propertyId, visitId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove visit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="detail-card">
      <h3 className="detail-card__title">Property visits</h3>
      <p className="muted tiny">
        Site visits appear on the{" "}
        <Link to="/calendar" className="linkish">
          Booking Calendar
        </Link>
        .
      </p>

      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? <p className="muted">Loading visits…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="muted">No visits scheduled yet.</p>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="simple-list">
          {items.map((v) => (
            <li key={v.id} className="link-row">
              <div>
                <strong>{v.visitDate}</strong>
                {v.visitTime ? ` · ${String(v.visitTime).slice(0, 5)}` : ""}
                <span className="muted">
                  {" "}
                  · {v.status}
                  {v.clientName ? ` · ${v.clientName}` : ""}
                </span>
                {v.notes ? (
                  <div className="muted tiny">{v.notes}</div>
                ) : null}
              </div>
              <button
                type="button"
                className="btn btn--tiny btn--danger-text"
                disabled={busy}
                onClick={() => handleDelete(v.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form className="inline-link-form" onSubmit={handleCreate}>
        <input
          type="date"
          value={form.visitDate}
          onChange={(e) => setForm((f) => ({ ...f, visitDate: e.target.value }))}
          disabled={busy}
          required
        />
        <input
          type="time"
          value={form.visitTime}
          onChange={(e) => setForm((f) => ({ ...f, visitTime: e.target.value }))}
          disabled={busy}
        />
        <select
          value={form.clientId}
          onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
          disabled={busy}
        >
          <option value="">Client (optional)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.clientName || `Client #${c.id}`}
            </option>
          ))}
        </select>
        <input
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          disabled={busy}
          placeholder="Notes"
        />
        <button
          type="submit"
          className="btn btn--primary btn--inline"
          disabled={busy}
        >
          Schedule
        </button>
      </form>
    </section>
  );
}
