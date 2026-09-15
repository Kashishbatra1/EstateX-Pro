import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listOwners, deleteOwner } from "../../api/owners.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import {
  VERIFICATION_STATUSES,
  formatLabel,
  maskCnic,
} from "../../utils/ownerHelpers.js";
import "../../styles/properties.css";

export default function OwnersPage() {
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

  const filters = {
    search: searchParams.get("search") || "",
    verificationStatus: searchParams.get("verificationStatus") || "",
    page: Number(searchParams.get("page") || 1),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listOwners({
        search: filters.search || undefined,
        verificationStatus: filters.verificationStatus || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load owners");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.verificationStatus, filters.page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSearchInput(searchParams.get("search") || "");
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
    updateFilters({ search: searchInput.trim(), page: 1 });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteOwner(deleteTarget.id);
      setToast(`Owner "${deleteTarget.ownerName}" moved to recycle bin`);
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
          <p className="page-toolbar__eyebrow">Relationships</p>
          <h2 className="page-toolbar__title">Owners</h2>
        </div>
        <Link to="/owners/new" className="btn btn--primary btn--inline">
          Add Owner
        </Link>
      </div>

      {toast ? <div className="toast toast--success">{toast}</div> : null}

      <form className="filters-bar filters-bar--compact" onSubmit={handleSearchSubmit}>
        <input
          className="filters-bar__search"
          type="search"
          placeholder="Search name, CNIC, phone, email…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={filters.verificationStatus}
          onChange={(e) =>
            updateFilters({ verificationStatus: e.target.value })
          }
          aria-label="Filter by verification"
        >
          <option value="">All verification</option>
          {VERIFICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatLabel(s)}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn--soft">
          Search
        </button>
      </form>

      {loading ? (
        <div className="state-panel">
          <div className="spinner" aria-hidden="true" />
          <p>Loading owners…</p>
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
          <p>No owners match your filters.</p>
          <Link to="/owners/new" className="btn btn--primary btn--inline">
            Add the first owner
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
                  <th>CNIC</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((owner) => (
                  <tr key={owner.id}>
                    <td>
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => navigate(`/owners/${owner.id}`)}
                      >
                        {owner.ownerName}
                      </button>
                    </td>
                    <td>
                      <div>{owner.phone || "—"}</div>
                      <div className="muted tiny">{owner.email || "—"}</div>
                    </td>
                    <td className="mono">{maskCnic(owner.cnic)}</td>
                    <td>
                      <StatusBadge status={owner.verificationStatus} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => navigate(`/owners/${owner.id}`)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => navigate(`/owners/${owner.id}/edit`)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn--tiny btn--danger-text"
                          onClick={() => setDeleteTarget(owner)}
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
              {pagination.total} owner{pagination.total === 1 ? "" : "s"}
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
        title="Archive owner?"
        message={
          deleteTarget
            ? `"${deleteTarget.ownerName}" will be soft-deleted and moved to the recycle bin.`
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
