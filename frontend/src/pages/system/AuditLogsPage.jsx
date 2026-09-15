import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { listAuditLogs, getAuditLog } from "../../api/auditLogs.js";
import { ApiError } from "../../api/client.js";
import "../../styles/properties.css";

function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function JsonBlock({ label, value }) {
  if (value == null) return null;
  return (
    <div style={{ marginTop: "0.75rem" }}>
      <div className="muted tiny">{label}</div>
      <pre
        style={{
          margin: "0.25rem 0 0",
          padding: "0.75rem",
          background: "rgba(0,0,0,0.04)",
          overflow: "auto",
          fontSize: "0.8rem",
          maxHeight: "16rem",
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export default function AuditLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const filters = {
    search: searchParams.get("search") || "",
    action: searchParams.get("action") || "",
    entityType: searchParams.get("entityType") || "",
    entityId: searchParams.get("entityId") || "",
    dateFrom: searchParams.get("dateFrom") || "",
    dateTo: searchParams.get("dateTo") || "",
    page: Number(searchParams.get("page") || 1),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listAuditLogs({
        search: filters.search || undefined,
        action: filters.action || undefined,
        entityType: filters.entityType || undefined,
        entityId: filters.entityId || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        page: filters.page,
        limit: 30,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.action,
    filters.entityType,
    filters.entityId,
    filters.dateFrom,
    filters.dateTo,
    filters.page,
  ]);

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

  async function openDetail(id) {
    setDetailLoading(true);
    setError("");
    try {
      setSelected(await getAuditLog(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load detail");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">System</p>
          <h2 className="page-toolbar__title">Audit Log</h2>
        </div>
      </div>
      <p className="muted">
        Read-only history of admin actions already recorded by the system.
      </p>

      {error ? <div className="alert alert--error">{error}</div> : null}

      <div className="filters-row">
        <input
          type="search"
          placeholder="Search action / entity / admin…"
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
        <input
          type="text"
          placeholder="Action contains…"
          value={filters.action}
          onChange={(e) => updateFilters({ action: e.target.value })}
        />
        <input
          type="text"
          placeholder="Entity type"
          value={filters.entityType}
          onChange={(e) => updateFilters({ entityType: e.target.value })}
        />
        <input
          type="number"
          placeholder="Entity id"
          value={filters.entityId}
          onChange={(e) => updateFilters({ entityId: e.target.value })}
          style={{ width: "7rem" }}
        />
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => updateFilters({ dateFrom: e.target.value })}
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => updateFilters({ dateTo: e.target.value })}
        />
      </div>

      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && items.length === 0 ? <p className="muted">No audit entries.</p> : null}

      {items.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Entity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{formatWhen(row.createdAt)}</td>
                  <td>{row.adminName || row.adminEmail || "—"}</td>
                  <td>{row.action}</td>
                  <td>
                    {row.entityType || "—"}
                    {row.entityId != null ? ` #${row.entityId}` : ""}
                  </td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="btn btn--tiny"
                      onClick={() => openDetail(row.id)}
                    >
                      View
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

      {detailLoading ? <p className="muted">Loading detail…</p> : null}

      {selected ? (
        <section className="form-section" style={{ marginTop: "1.5rem" }}>
          <div className="page-toolbar">
            <h3 className="form-section__title">Entry #{selected.id}</h3>
            <button
              type="button"
              className="btn btn--ghost btn--inline"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
          <div className="detail-grid">
            <div>
              <span className="muted">When</span>
              <div>{formatWhen(selected.createdAt)}</div>
            </div>
            <div>
              <span className="muted">Admin</span>
              <div>
                {selected.adminName || "—"}
                {selected.adminEmail ? ` (${selected.adminEmail})` : ""}
              </div>
            </div>
            <div>
              <span className="muted">Action</span>
              <div>{selected.action}</div>
            </div>
            <div>
              <span className="muted">Entity</span>
              <div>
                {selected.entityType || "—"}
                {selected.entityId != null ? ` #${selected.entityId}` : ""}
              </div>
            </div>
            {selected.ipAddress ? (
              <div>
                <span className="muted">IP</span>
                <div>{selected.ipAddress}</div>
              </div>
            ) : null}
          </div>
          <JsonBlock label="Old data" value={selected.oldData} />
          <JsonBlock label="New data" value={selected.newData} />
        </section>
      ) : null}
    </div>
  );
}
