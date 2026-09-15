import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listBookings, deleteBooking } from "../../api/bookings.js";
import { listProperties } from "../../api/properties.js";
import { listClients } from "../../api/clients.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  BOOKING_STATUSES,
  formatLabel,
  formatApiError,
  canArchiveBooking,
} from "../../utils/bookingHelpers.js";
import "../../styles/properties.css";

export default function BookingsPage() {
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
  const [properties, setProperties] = useState([]);
  const [clients, setClients] = useState([]);
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
    status: searchParams.get("status") || "",
    propertyId: searchParams.get("propertyId") || "",
    clientId: searchParams.get("clientId") || "",
    page: Number(searchParams.get("page") || 1),
  };

  useEffect(() => {
    Promise.all([
      listProperties({ limit: 100 }),
      listClients({ limit: 100 }),
    ])
      .then(([propsRes, clientsRes]) => {
        setProperties(propsRes.items || []);
        setClients(clientsRes.items || []);
      })
      .catch(() => {
        setProperties([]);
        setClients([]);
      });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listBookings({
        search: filters.search || undefined,
        status: filters.status || undefined,
        propertyId: filters.propertyId || undefined,
        clientId: filters.clientId || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError ? formatApiError(err) : "Failed to load bookings"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.status,
    filters.propertyId,
    filters.clientId,
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
      await deleteBooking(deleteTarget.id);
      setToast(`Booking ${deleteTarget.bookingCode} moved to recycle bin`);
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

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Transactions</p>
          <h2 className="page-toolbar__title">Bookings</h2>
        </div>
        <Link to="/bookings/new" className="btn btn--primary btn--inline">
          Add Booking
        </Link>
      </div>

      {toast ? <div className="toast toast--success">{toast}</div> : null}

      <form className="filters-bar filters-bar--bookings" onSubmit={handleSearchSubmit}>
        <input
          className="filters-bar__search"
          type="search"
          placeholder="Search code, ID, receipt…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={filters.status}
          onChange={(e) => updateFilters({ status: e.target.value })}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatLabel(s)}
            </option>
          ))}
        </select>
        <select
          value={filters.propertyId}
          onChange={(e) => updateFilters({ propertyId: e.target.value })}
          aria-label="Filter by property"
        >
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.propertyCode || `#${p.id}`} — {p.title}
            </option>
          ))}
        </select>
        <select
          value={filters.clientId}
          onChange={(e) => updateFilters({ clientId: e.target.value })}
          aria-label="Filter by client"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.clientName}
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
          <p>Loading bookings…</p>
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
          <p>No bookings match your filters.</p>
          <Link to="/bookings/new" className="btn btn--primary btn--inline">
            Create the first booking
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
                  <th>Property</th>
                  <th>Client</th>
                  <th>Booked</th>
                  <th>Total</th>
                  <th>Down</th>
                  <th>Remaining</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((booking) => (
                  <tr key={booking.id}>
                    <td className="mono">
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => navigate(`/bookings/${booking.id}`)}
                      >
                        {booking.bookingCode || `#${booking.id}`}
                      </button>
                    </td>
                    <td>
                      <div>{booking.propertyTitle || "—"}</div>
                      <div className="muted tiny mono">
                        {booking.propertyCode || `P#${booking.propertyId}`}
                      </div>
                    </td>
                    <td>{booking.clientName || `C#${booking.clientId}`}</td>
                    <td>
                      {booking.bookedAt
                        ? new Date(booking.bookedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>{formatMoney(booking.totalPrice)}</td>
                    <td>{formatMoney(booking.bookingAmount)}</td>
                    <td>{formatMoney(booking.remainingBalance)}</td>
                    <td>
                      <StatusBadge status={booking.status} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => navigate(`/bookings/${booking.id}`)}
                        >
                          View
                        </button>
                        {canArchiveBooking(booking.status) ? (
                          <button
                            type="button"
                            className="btn btn--tiny btn--danger-text"
                            onClick={() => setDeleteTarget(booking)}
                          >
                            Archive
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span className="muted">
              {pagination.total} booking{pagination.total === 1 ? "" : "s"}
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
        title="Archive booking?"
        message={
          deleteTarget
            ? `"${deleteTarget.bookingCode}" will be soft-deleted. Confirmed bookings must be cancelled or completed first.`
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
