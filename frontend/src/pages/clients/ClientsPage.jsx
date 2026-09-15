import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listClients, deleteClient } from "../../api/clients.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import {
  CLIENT_TYPES,
  formatLabel,
  maskCnic,
} from "../../utils/clientHelpers.js";
import "../../styles/properties.css";

export default function ClientsPage() {
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
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || ""
  );
  const [locationInput, setLocationInput] = useState(
    searchParams.get("preferredLocation") || ""
  );

  const [leadInput, setLeadInput] = useState(
    searchParams.get("leadSource") || ""
  );

  const filters = {
    search: searchParams.get("search") || "",
    clientType: searchParams.get("clientType") || "",
    preferredLocation: searchParams.get("preferredLocation") || "",
    leadSource: searchParams.get("leadSource") || "",
    page: Number(searchParams.get("page") || 1),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listClients({
        search: filters.search || undefined,
        clientType: filters.clientType || undefined,
        preferredLocation: filters.preferredLocation || undefined,
        leadSource: filters.leadSource || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load clients");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.clientType,
    filters.preferredLocation,
    filters.leadSource,
    filters.page,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSearchInput(searchParams.get("search") || "");
    setLocationInput(searchParams.get("preferredLocation") || "");
    setLeadInput(searchParams.get("leadSource") || "");
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
    updateFilters({
      search: searchInput.trim(),
      preferredLocation: locationInput.trim(),
      leadSource: leadInput.trim(),
      page: 1,
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteClient(deleteTarget.id);
      setToast(`Client "${deleteTarget.clientName}" moved to recycle bin`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Archive failed");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">CRM</p>
          <h2 className="page-toolbar__title">Clients</h2>
        </div>
        <Link to="/clients/new" className="btn btn--primary btn--inline">
          Add Client
        </Link>
      </div>

      {toast ? <div className="toast toast--success">{toast}</div> : null}

      <form className="filters-bar filters-bar--clients" onSubmit={handleSearchSubmit}>
        <input
          className="filters-bar__search"
          type="search"
          placeholder="Search name, CNIC, phone, email…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={filters.clientType}
          onChange={(e) => updateFilters({ clientType: e.target.value })}
          aria-label="Filter by client type"
        >
          <option value="">All types</option>
          {CLIENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {formatLabel(t)}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Preferred location"
          value={locationInput}
          onChange={(e) => setLocationInput(e.target.value)}
          aria-label="Filter by preferred location"
        />
        <input
          type="text"
          placeholder="Lead source"
          value={leadInput}
          onChange={(e) => setLeadInput(e.target.value)}
          aria-label="Filter by lead source"
        />
        <button type="submit" className="btn btn--soft">
          Search
        </button>
      </form>

      {loading ? (
        <div className="state-panel">
          <div className="spinner" aria-hidden="true" />
          <p>Loading clients…</p>
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
          <p>No clients match your filters.</p>
          <Link to="/clients/new" className="btn btn--primary btn--inline">
            Add the first client
          </Link>
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Follow-up</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        {client.clientName}
                      </button>
                      <div className="muted tiny mono">
                        {maskCnic(client.cnic)}
                      </div>
                    </td>
                    <td>
                      <div>{client.phone || "—"}</div>
                      <div className="muted tiny">{client.email || "—"}</div>
                    </td>
                    <td>
                      <StatusBadge status={client.clientType} />
                    </td>
                    <td>{client.preferredLocation || "—"}</td>
                    <td>
                      {client.nextFollowUpDate
                        ? String(client.nextFollowUpDate).slice(0, 10)
                        : "—"}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => navigate(`/clients/${client.id}`)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => navigate(`/clients/${client.id}/edit`)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn--tiny btn--danger-text"
                          onClick={() => setDeleteTarget(client)}
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
              {pagination.total} client{pagination.total === 1 ? "" : "s"}
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
        title="Archive client?"
        message={
          deleteTarget
            ? `"${deleteTarget.clientName}" will be soft-deleted. Archive is blocked if the client still has active bookings.`
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
