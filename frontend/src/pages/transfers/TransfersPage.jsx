import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listTransfers, deleteTransfer } from "../../api/transfers.js";
import { ApiError } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  TRANSFER_TYPES,
  formatApiError,
  formatLabel,
  totalCharges,
} from "../../utils/transferHelpers.js";
import "../../styles/properties.css";

export default function TransfersPage() {
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
    propertyId: searchParams.get("propertyId") || "",
    transferType: searchParams.get("transferType") || "",
    transferFrom: searchParams.get("transferFrom") || "",
    transferTo: searchParams.get("transferTo") || "",
    page: Number(searchParams.get("page") || 1),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listTransfers({
        search: filters.search || undefined,
        propertyId: filters.propertyId || undefined,
        transferType: filters.transferType || undefined,
        transferFrom: filters.transferFrom || undefined,
        transferTo: filters.transferTo || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiError(err)
          : "Failed to load transfers"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.propertyId,
    filters.transferType,
    filters.transferFrom,
    filters.transferTo,
    filters.page,
  ]);

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
      await deleteTransfer(deleteTarget.id);
      setToast("Transfer moved to recycle bin");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? formatApiError(err) : "Archive failed"
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const newLink = filters.propertyId
    ? `/transfers/new?propertyId=${filters.propertyId}`
    : "/transfers/new";

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Property operations</p>
          <h2 className="page-toolbar__title">Resale & Transfers</h2>
        </div>
        <Link to={newLink} className="btn btn--primary btn--inline">
          Record Transfer
        </Link>
      </div>

      {toast ? <div className="toast toast--success">{toast}</div> : null}

      <form className="filters-bar" onSubmit={handleSearchSubmit}>
        <input
          className="filters-bar__search"
          type="search"
          placeholder="Search property, owner, client…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <input
          type="number"
          min="1"
          placeholder="Property ID"
          value={filters.propertyId}
          onChange={(e) => updateFilters({ propertyId: e.target.value })}
          aria-label="Filter by property id"
        />
        <select
          value={filters.transferType}
          onChange={(e) => updateFilters({ transferType: e.target.value })}
          aria-label="Filter by transfer type"
        >
          <option value="">All types</option>
          {TRANSFER_TYPES.map((t) => (
            <option key={t} value={t}>
              {formatLabel(t)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.transferFrom}
          onChange={(e) => updateFilters({ transferFrom: e.target.value })}
          aria-label="From date"
        />
        <input
          type="date"
          value={filters.transferTo}
          onChange={(e) => updateFilters({ transferTo: e.target.value })}
          aria-label="To date"
        />
        <button type="submit" className="btn btn--soft">
          Search
        </button>
      </form>

      {loading ? (
        <div className="state-panel">
          <div className="spinner" aria-hidden="true" />
          <p>Loading transfers…</p>
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
          <p>No transfers match your filters.</p>
          <Link to={newLink} className="btn btn--primary btn--inline">
            Record the first transfer
          </Link>
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Charges</th>
                  <th>NOC</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => navigate(`/transfers/${row.id}`)}
                      >
                        {row.propertyCode || `Property #${row.propertyId}`}
                      </button>
                      <div className="muted tiny">{row.propertyTitle || ""}</div>
                    </td>
                    <td>
                      <StatusBadge status={row.transferType} />
                    </td>
                    <td>{row.transferDate || "—"}</td>
                    <td>
                      {row.fromOwnerName || row.fromClientName || "—"}
                      <div className="muted tiny">
                        {[row.fromOwnerName && "Owner", row.fromClientName && "Client"]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td>
                      {row.toOwnerName || row.toClientName || "—"}
                      <div className="muted tiny">
                        {[row.toOwnerName && "Owner", row.toClientName && "Client"]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td>{formatMoney(totalCharges(row))}</td>
                    <td>
                      {row.nocForTransfer ? (
                        <span className="muted">
                          {row.nocStatus || "Required"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => navigate(`/transfers/${row.id}`)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => navigate(`/transfers/${row.id}/edit`)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn--tiny btn--danger-text"
                          onClick={() => setDeleteTarget(row)}
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
              {pagination.total} transfer{pagination.total === 1 ? "" : "s"}
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
        title="Archive transfer?"
        message={
          deleteTarget
            ? `Transfer #${deleteTarget.id} for ${
                deleteTarget.propertyCode ||
                `property #${deleteTarget.propertyId}`
              } will be soft-deleted. The previous-owner snapshot is retained.`
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
