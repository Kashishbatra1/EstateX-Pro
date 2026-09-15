import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listVendors, deleteVendor } from "../../api/vendors.js";
import { ApiError } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import { formatApiError } from "../../utils/vendorHelpers.js";
import "../../styles/properties.css";

export default function VendorsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(location.state?.flash || "");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const filters = {
    search: searchParams.get("search") || "",
    preferred: searchParams.get("preferred") || "",
    page: Number(searchParams.get("page") || 1),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listVendors({
        search: filters.search || undefined,
        preferred: filters.preferred || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.preferred, filters.page]);

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

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteVendor(deleteTarget.id);
      setDeleteTarget(null);
      setToast("Vendor archived");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Office</p>
          <h2 className="page-toolbar__title">Vendors</h2>
        </div>
        <Link to="/vendors/new" className="btn btn--primary btn--inline">
          Add vendor
        </Link>
      </div>
      {toast ? <div className="alert alert--success">{toast}</div> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      <form
        className="filters-bar"
        onSubmit={(e) => {
          e.preventDefault();
          updateFilters({ search: searchInput.trim() });
        }}
      >
        <input
          className="filters-bar__search"
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search vendors…"
        />
        <select
          value={filters.preferred}
          onChange={(e) => updateFilters({ preferred: e.target.value })}
        >
          <option value="">All vendors</option>
          <option value="true">Preferred only</option>
        </select>
        <button type="submit" className="btn btn--soft btn--inline">
          Search
        </button>
      </form>

      {loading ? <p className="muted">Loading vendors…</p> : null}
      {!loading && items.length === 0 ? (
        <div className="state-panel">
          <p>No vendors found.</p>
          <Link to="/vendors/new" className="btn btn--primary btn--inline">
            Add vendor
          </Link>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Contact</th>
                <th>Services</th>
                <th>Balance</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr
                  key={v.id}
                  className="clickable-row"
                  onClick={() => navigate(`/vendors/${v.id}`)}
                >
                  <td>
                    <strong>{v.vendorName}</strong>
                    {v.isPreferred ? (
                      <span className="pill-flag" style={{ marginLeft: 6 }}>
                        Preferred
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {v.contactPerson || "—"}
                    <div className="muted tiny">{v.phone || ""}</div>
                  </td>
                  <td>{v.services || "—"}</td>
                  <td>{formatMoney(v.outstandingBalance)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--tiny btn--danger-text"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(v);
                      }}
                    >
                      Archive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pagination.totalPages > 1 ? (
        <div className="history-pagination">
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            disabled={pagination.page <= 1}
            onClick={() => updateFilters({ page: pagination.page - 1 })}
          >
            Previous
          </button>
          <span className="muted tiny">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => updateFilters({ page: pagination.page + 1 })}
          >
            Next
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Archive vendor?"
        message={deleteTarget ? `"${deleteTarget.vendorName}" will be soft-deleted.` : ""}
        confirmLabel="Archive"
        danger
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
