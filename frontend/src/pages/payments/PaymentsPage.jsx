import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listPayments, reversePayment } from "../../api/payments.js";
import { listBookings } from "../../api/bookings.js";
import { listPaymentMethods, listProperties } from "../../api/properties.js";
import { ApiError } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatMoney } from "../../utils/format.js";
import { formatApiError } from "../../utils/paymentHelpers.js";
import "../../styles/properties.css";

export default function PaymentsPage() {
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
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [reverseTarget, setReverseTarget] = useState(null);
  const [reversing, setReversing] = useState(false);
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || ""
  );

  const filters = {
    search: searchParams.get("search") || "",
    bookingId: searchParams.get("bookingId") || "",
    propertyId: searchParams.get("propertyId") || "",
    paymentMethodId: searchParams.get("paymentMethodId") || "",
    paymentFrom: searchParams.get("paymentFrom") || "",
    paymentTo: searchParams.get("paymentTo") || "",
    page: Number(searchParams.get("page") || 1),
  };

  useEffect(() => {
    Promise.all([
      listBookings({ limit: 100 }),
      listProperties({ limit: 100 }),
      listPaymentMethods(),
    ])
      .then(([bookingsRes, propertiesRes, methodsRes]) => {
        setBookings(bookingsRes.items || []);
        setProperties(propertiesRes.items || []);
        setMethods(
          (methodsRes || []).filter((m) => m.isActive !== false)
        );
      })
      .catch(() => {
        setBookings([]);
        setProperties([]);
        setMethods([]);
      });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listPayments({
        search: filters.search || undefined,
        bookingId: filters.bookingId || undefined,
        propertyId: filters.propertyId || undefined,
        paymentMethodId: filters.paymentMethodId || undefined,
        paymentFrom: filters.paymentFrom || undefined,
        paymentTo: filters.paymentTo || undefined,
        page: filters.page,
        limit: 20,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError ? formatApiError(err) : "Failed to load payments"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.bookingId,
    filters.propertyId,
    filters.paymentMethodId,
    filters.paymentFrom,
    filters.paymentTo,
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

  async function confirmReverse() {
    if (!reverseTarget) return;
    setReversing(true);
    try {
      await reversePayment(reverseTarget.id);
      setToast(`Payment ${reverseTarget.paymentCode} reversed`);
      setReverseTarget(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? formatApiError(err) : "Reversal failed"
      );
      setReverseTarget(null);
    } finally {
      setReversing(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Transactions</p>
          <h2 className="page-toolbar__title">Payments</h2>
        </div>
        <Link to="/payments/new" className="btn btn--primary btn--inline">
          Add Payment
        </Link>
      </div>

      {toast ? <div className="toast toast--success">{toast}</div> : null}

      <form
        className="filters-bar filters-bar--payments"
        onSubmit={handleSearchSubmit}
      >
        <input
          className="filters-bar__search"
          type="search"
          placeholder="Search code, booking, reference…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={filters.bookingId}
          onChange={(e) => updateFilters({ bookingId: e.target.value })}
          aria-label="Filter by booking"
        >
          <option value="">All bookings</option>
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.bookingCode} — {b.clientName || "Client"}
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
              {p.propertyCode || `P#${p.id}`} — {p.title}
            </option>
          ))}
        </select>
        <select
          value={filters.paymentMethodId}
          onChange={(e) => updateFilters({ paymentMethodId: e.target.value })}
          aria-label="Filter by payment method"
        >
          <option value="">All methods</option>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.methodName}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.paymentFrom}
          onChange={(e) => updateFilters({ paymentFrom: e.target.value })}
          aria-label="From date"
        />
        <input
          type="date"
          value={filters.paymentTo}
          onChange={(e) => updateFilters({ paymentTo: e.target.value })}
          aria-label="To date"
        />
        <button type="submit" className="btn btn--soft">
          Search
        </button>
      </form>

      {loading ? (
        <div className="state-panel">
          <div className="spinner" aria-hidden="true" />
          <p>Loading payments…</p>
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
          <p>No payments match your filters.</p>
          <Link to="/payments/new" className="btn btn--primary btn--inline">
            Record the first payment
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
                  <th>Booking</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((payment) => (
                  <tr key={payment.id}>
                    <td className="mono">
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => navigate(`/payments/${payment.id}`)}
                      >
                        {payment.paymentCode || `#${payment.id}`}
                      </button>
                    </td>
                    <td>
                      <div className="mono">{payment.bookingCode || "—"}</div>
                      <div className="muted tiny">
                        {payment.propertyCode || ""}
                      </div>
                    </td>
                    <td>{payment.clientName || "—"}</td>
                    <td>
                      {payment.paymentDate
                        ? String(payment.paymentDate).slice(0, 10)
                        : "—"}
                    </td>
                    <td>{formatMoney(payment.amount)}</td>
                    <td>{payment.paymentMethodName || "—"}</td>
                    <td className="mono">{payment.referenceNumber || "—"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => navigate(`/payments/${payment.id}`)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn--tiny btn--danger-text"
                          onClick={() => setReverseTarget(payment)}
                        >
                          Reverse
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
              {pagination.total} payment{pagination.total === 1 ? "" : "s"}
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
        open={Boolean(reverseTarget)}
        title="Reverse payment?"
        message={
          reverseTarget
            ? `"${reverseTarget.paymentCode}" will be soft-deleted. The backend will restore booking and installment balances.`
            : ""
        }
        confirmLabel="Reverse payment"
        danger
        loading={reversing}
        onCancel={() => setReverseTarget(null)}
        onConfirm={confirmReverse}
      />
    </div>
  );
}
