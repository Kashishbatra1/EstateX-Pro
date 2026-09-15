import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listPettyCash, deletePettyCash } from "../../api/pettyCash.js";
import { ApiError } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import { formatApiError } from "../../utils/pettyCashHelpers.js";
import "../../styles/properties.css";

export default function PettyCashPage() {
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
    active: searchParams.get("active") || "",
    page: Number(searchParams.get("page") || 1),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listPettyCash({
        search: filters.search || undefined,
        active: filters.active || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.active, filters.page]);

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
      await deletePettyCash(deleteTarget.id);
      setDeleteTarget(null);
      setToast("Account archived");
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
          <p className="page-toolbar__eyebrow">Finance</p>
          <h2 className="page-toolbar__title">Petty Cash</h2>
        </div>
        <Link to="/petty-cash/new" className="btn btn--primary btn--inline">
          Add account
        </Link>
      </div>

      {toast ? <div className="alert alert--success">{toast}</div> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      <div className="filters-row">
        <input
          type="search"
          placeholder="Search…"
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
        <select
          value={filters.active}
          onChange={(e) => updateFilters({ active: e.target.value })}
        >
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && items.length === 0 ? <p className="muted">No petty cash accounts yet.</p> : null}

      {items.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Custodian</th>
                <th>Float</th>
                <th>Balance</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/petty-cash/${a.id}`}>{a.accountName}</Link>
                  </td>
                  <td>{a.custodianName || "—"}</td>
                  <td>{formatMoney(a.floatAmount)}</td>
                  <td>{formatMoney(a.currentBalance)}</td>
                  <td>{a.isActive ? "Active" : "Inactive"}</td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="btn btn--tiny"
                      onClick={() => navigate(`/petty-cash/${a.id}/edit`)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--tiny btn--danger-text"
                      onClick={() => setDeleteTarget(a)}
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Archive account?"
        message={
          deleteTarget ? `Move “${deleteTarget.accountName}” to the recycle bin?` : ""
        }
        confirmLabel="Archive"
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
