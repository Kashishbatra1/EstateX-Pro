import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listCommissions, deleteCommission } from "../../api/commissions.js";
import { ApiError } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  COMMISSION_PAYMENT_STATUSES,
  formatApiError,
  formatLabel,
} from "../../utils/commissionHelpers.js";
import "../../styles/properties.css";
import "../../styles/commissions.css";

export default function CommissionsPage() {
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
    bookingId: searchParams.get("bookingId") || "",
    paymentStatus: searchParams.get("paymentStatus") || "",
    isManualOverride: searchParams.get("isManualOverride") || "",
    page: Number(searchParams.get("page") || 1),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listCommissions({
        search: filters.search || undefined,
        propertyId: filters.propertyId || undefined,
        bookingId: filters.bookingId || undefined,
        paymentStatus: filters.paymentStatus || undefined,
        isManualOverride: filters.isManualOverride || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiError(err)
          : "Failed to load commissions"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.propertyId,
    filters.bookingId,
    filters.paymentStatus,
    filters.isManualOverride,
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
    updateFilters({
      search: searchInput.trim(),
      page: 1,
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCommission(deleteTarget.id);
      setToast("Commission moved to recycle bin");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? formatApiError(err) : "Delete failed"
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Financial</p>
          <h2 className="page-toolbar__title">Commission & Brokerage</h2>
        </div>
        <Link to="/commissions/new" className="btn btn--primary btn--inline">
          Add Commission
        </Link>
      </div>

      {toast ? <div className="toast toast--success">{toast}</div> : null}

      <form
        className="filters-bar filters-bar--commissions"
        onSubmit={handleSearchSubmit}
      >
        <input
          className="filters-bar__search"
          type="search"
          placeholder="Search property, booking, client…"
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
        <input
          type="number"
          min="1"
          placeholder="Booking ID"
          value={filters.bookingId}
          onChange={(e) => updateFilters({ bookingId: e.target.value })}
          aria-label="Filter by booking id"
        />
        <select
          value={filters.paymentStatus}
          onChange={(e) => updateFilters({ paymentStatus: e.target.value })}
          aria-label="Filter by payment status"
        >
          <option value="">All payment statuses</option>
          {COMMISSION_PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatLabel(s)}
            </option>
          ))}
        </select>
        <select
          value={filters.isManualOverride}
          onChange={(e) => updateFilters({ isManualOverride: e.target.value })}
          aria-label="Filter by override"
        >
          <option value="">All overrides</option>
          <option value="true">Manual override</option>
          <option value="false">Calculated only</option>
        </select>
        <button type="submit" className="btn btn--soft">
          Search
        </button>
      </form>

      {loading ? (
        <div className="state-panel">
          <div className="spinner" aria-hidden="true" />
          <p>Loading commissions…</p>
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
          <p>No commissions match your filters.</p>
          <Link to="/commissions/new" className="btn btn--primary btn--inline">
            Configure the first commission
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
                  <th>Booking</th>
                  <th>%</th>
                  <th>Commission</th>
                  <th>Buyer brokerage</th>
                  <th>Seller brokerage</th>
                  <th>Status</th>
                  <th>Date</th>
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
                        onClick={() => navigate(`/commissions/${row.id}`)}
                      >
                        {row.propertyCode || `Property #${row.propertyId}`}
                      </button>
                      <div className="muted tiny">
                        {row.propertyTitle || ""}
                      </div>
                    </td>
                    <td>
                      {row.bookingCode ? (
                        <>
                          <div className="mono">{row.bookingCode}</div>
                          <div className="muted tiny">
                            {row.clientName || ""}
                          </div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {row.commissionPercentage != null
                        ? `${row.commissionPercentage}%`
                        : "—"}
                      {row.isManualOverride ? (
                        <div className="muted tiny">Override</div>
                      ) : null}
                    </td>
                    <td>
                      <div>{formatMoney(row.finalAmount)}</div>
                      {row.isManualOverride &&
                      row.calculatedAmount != null &&
                      Number(row.calculatedAmount) !==
                        Number(row.finalAmount) ? (
                        <div className="muted tiny">
                          Calc {formatMoney(row.calculatedAmount)}
                        </div>
                      ) : null}
                    </td>
                    <td>{formatMoney(row.brokerageFromBuyer)}</td>
                    <td>{formatMoney(row.brokerageFromSeller)}</td>
                    <td>
                      <StatusBadge status={row.paymentStatus} />
                    </td>
                    <td>
                      {row.createdAt
                        ? String(row.createdAt).slice(0, 10)
                        : "—"}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => navigate(`/commissions/${row.id}`)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() =>
                            navigate(`/commissions/${row.id}/edit`)
                          }
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
              {pagination.total} commission
              {pagination.total === 1 ? "" : "s"}
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
        title="Archive commission?"
        message={
          deleteTarget
            ? `Commission for ${
                deleteTarget.propertyCode || `property #${deleteTarget.propertyId}`
              } will be soft-deleted (recycle bin). Financial history is retained.`
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
