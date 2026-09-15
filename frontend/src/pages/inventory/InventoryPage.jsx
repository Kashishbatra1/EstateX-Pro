import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listInventory, deleteInventoryItem } from "../../api/inventory.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/ui/PageStates.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  INVENTORY_STATUSES,
  formatLabel,
  formatApiError,
} from "../../utils/inventoryHelpers.js";
import "../../styles/properties.css";

export default function InventoryPage() {
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
  const [toast, setToast] = useState(location.state?.flash || "");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || ""
  );

  const filters = {
    search: searchParams.get("search") || "",
    status: searchParams.get("status") || "",
    page: Number(searchParams.get("page") || 1),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listInventory({
        search: filters.search || undefined,
        status: filters.status || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setItems([]);
      setError(
        err instanceof ApiError ? formatApiError(err) : "Failed to load inventory"
      );
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.status, filters.page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function updateFilters(patch) {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    });
    if (!("page" in patch)) next.set("page", "1");
    setSearchParams(next);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteInventoryItem(deleteTarget.id);
      setDeleteTarget(null);
      setToast("Item archived");
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
          <p className="page-toolbar__eyebrow">Operations</p>
          <h2 className="page-toolbar__title">Inventory</h2>
        </div>
        <div className="page-toolbar__actions">
          <Link to="/inventory/new" className="btn btn--primary btn--inline">
            Add item
          </Link>
        </div>
      </div>

      {toast ? (
        <div className="toast toast--success" role="status">
          {toast}
        </div>
      ) : null}

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
          placeholder="Search item name, type, location…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={filters.status}
          onChange={(e) => updateFilters({ status: e.target.value })}
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {INVENTORY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatLabel(s)}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn--soft btn--inline">
          Search
        </button>
      </form>

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? <LoadingState message="Loading inventory…" /> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No inventory items"
          message="Add office equipment and stock items to track quantity, status, and assignment."
          actionLabel="Add first item"
          actionTo="/inventory/new"
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Assigned to</th>
                <th>Cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="clickable-row"
                  onClick={() => navigate(`/inventory/${item.id}`)}
                >
                  <td>
                    <strong>{item.itemName}</strong>
                    <div className="muted tiny">
                      {item.itemType || "—"}
                      {item.locationNotes ? ` · ${item.locationNotes}` : ""}
                    </div>
                  </td>
                  <td>
                    {item.quantity} {item.unit || "pcs"}
                  </td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>{item.assignedToName || "—"}</td>
                  <td>
                    {item.purchaseCost != null
                      ? formatMoney(item.purchaseCost)
                      : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--tiny btn--danger-text"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(item);
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
        title="Archive inventory item?"
        message={
          deleteTarget
            ? `"${deleteTarget.itemName}" will be soft-deleted. Purchase history remains stored.`
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
