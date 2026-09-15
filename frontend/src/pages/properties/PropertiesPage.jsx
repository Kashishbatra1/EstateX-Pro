import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listProperties, deleteProperty } from "../../api/properties.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  PROPERTY_STATUSES,
  PROPERTY_CATEGORIES,
  PROPERTY_PURPOSES,
  formatLabel,
  locationLabel,
  priceLabel,
} from "../../utils/propertyHelpers.js";
import "../../styles/properties.css";

export default function PropertiesPage() {
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

  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [cityInput, setCityInput] = useState(searchParams.get("city") || "");
  const [typeInput, setTypeInput] = useState(
    searchParams.get("propertyType") || ""
  );
  const filters = {
    search: searchParams.get("search") || "",
    status: searchParams.get("status") || "",
    category: searchParams.get("category") || "",
    purpose: searchParams.get("purpose") || "",
    city: searchParams.get("city") || "",
    propertyType: searchParams.get("propertyType") || "",
    page: Number(searchParams.get("page") || 1),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listProperties({
        search: filters.search || undefined,
        status: filters.status || undefined,
        category: filters.category || undefined,
        purpose: filters.purpose || undefined,
        city: filters.city || undefined,
        propertyType: filters.propertyType || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load properties");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.status,
    filters.category,
    filters.purpose,
    filters.city,
    filters.propertyType,
    filters.page,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSearchInput(searchParams.get("search") || "");
    setCityInput(searchParams.get("city") || "");
    setTypeInput(searchParams.get("propertyType") || "");
  }, [searchParams]);

  useEffect(() => {
    const flash = location.state?.flash;
    if (flash) {
      setToast(flash);
      navigate(location.pathname + location.search, { replace: true, state: {} });
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
      city: cityInput.trim(),
      propertyType: typeInput.trim(),
      page: 1,
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProperty(deleteTarget.id);
      setToast(`Property ${deleteTarget.propertyCode || deleteTarget.id} moved to recycle bin`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Inventory</p>
          <h2 className="page-toolbar__title">Properties</h2>
        </div>
        <Link to="/properties/new" className="btn btn--primary btn--inline">
          Add Property
        </Link>
      </div>

      {toast ? <div className="toast toast--success">{toast}</div> : null}

      <form className="filters-bar" onSubmit={handleSearchSubmit}>
        <input
          className="filters-bar__search"
          type="search"
          placeholder="Search title, code, city, area…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={filters.status}
          onChange={(e) => updateFilters({ status: e.target.value })}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {PROPERTY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatLabel(s)}
            </option>
          ))}
        </select>
        <select
          value={filters.category}
          onChange={(e) => updateFilters({ category: e.target.value })}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {PROPERTY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {formatLabel(c)}
            </option>
          ))}
        </select>
        <select
          value={filters.purpose}
          onChange={(e) => updateFilters({ purpose: e.target.value })}
          aria-label="Filter by purpose"
        >
          <option value="">All purposes</option>
          {PROPERTY_PURPOSES.map((p) => (
            <option key={p} value={p}>
              {formatLabel(p)}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="City"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          aria-label="Filter by city"
        />
        <input
          type="text"
          placeholder="Property type"
          value={typeInput}
          onChange={(e) => setTypeInput(e.target.value)}
          aria-label="Filter by property type"
        />
        <button type="submit" className="btn btn--soft">
          Search
        </button>
      </form>

      {loading ? (
        <div className="state-panel">
          <div className="spinner" aria-hidden="true" />
          <p>Loading properties…</p>
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
          <p>No properties match your filters.</p>
          <Link to="/properties/new" className="btn btn--primary btn--inline">
            Add the first property
          </Link>
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((property) => (
                  <tr key={property.id}>
                    <td className="mono">{property.propertyCode || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => navigate(`/properties/${property.id}`)}
                      >
                        {property.title}
                      </button>
                      <div className="muted tiny">
                        {formatLabel(property.purpose)} ·{" "}
                        {formatLabel(property.category)}
                      </div>
                    </td>
                    <td>{property.propertyType || "—"}</td>
                    <td>{locationLabel(property)}</td>
                    <td>{priceLabel(property, formatMoney)}</td>
                    <td>
                      <StatusBadge status={property.status} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => navigate(`/properties/${property.id}`)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() =>
                            navigate(`/properties/${property.id}/edit`)
                          }
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn--tiny btn--danger-text"
                          onClick={() => setDeleteTarget(property)}
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
              {pagination.total} propert{pagination.total === 1 ? "y" : "ies"}
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
        title="Archive property?"
        message={
          deleteTarget
            ? `"${deleteTarget.title}" will be soft-deleted and moved to the recycle bin. It will no longer appear in the active list.`
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
