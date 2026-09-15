import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchBookingsReport,
  fetchPaymentsReport,
  fetchExpensesReport,
  fetchPropertiesReport,
  downloadBookingsReport,
  downloadPaymentsReport,
  downloadExpensesReport,
  downloadPropertiesReport,
} from "../../api/reports.js";
import { listProperties, listPaymentMethods } from "../../api/properties.js";
import { listClients } from "../../api/clients.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import DistributionChart from "../../components/reports/DistributionChart.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  REPORT_TABS,
  BOOKING_STATUSES,
  PROPERTY_STATUSES,
  APPROVAL_STATUSES,
  DATE_PRESETS,
  getDatePresetRange,
  validateDateRange,
  formatLabel,
  formatApiError,
  mapCountSeries,
} from "../../utils/reportHelpers.js";
import "../../styles/properties.css";
import "../../styles/dashboard.css";
import "../../styles/reports.css";

function SummaryCard({ label, value }) {
  return (
    <article className="stat-card">
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{value}</p>
    </article>
  );
}

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = REPORT_TABS.some((t) => t.id === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "bookings";

  const [properties, setProperties] = useState([]);
  const [clients, setClients] = useState([]);
  const [methods, setMethods] = useState([]);

  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [exporting, setExporting] = useState("");
  const [exportError, setExportError] = useState("");

  const filters = useMemo(
    () => ({
      preset: searchParams.get("preset") || "this_month",
      dateFrom: searchParams.get("dateFrom") || "",
      dateTo: searchParams.get("dateTo") || "",
      status: searchParams.get("status") || "",
      propertyId: searchParams.get("propertyId") || "",
      clientId: searchParams.get("clientId") || "",
      bookingId: searchParams.get("bookingId") || "",
      paymentMethodId: searchParams.get("paymentMethodId") || "",
      categoryId: searchParams.get("categoryId") || "",
      approvalStatus: searchParams.get("approvalStatus") || "",
      propertyType: searchParams.get("propertyType") || "",
      purpose: searchParams.get("purpose") || "",
      category: searchParams.get("category") || "",
      city: searchParams.get("city") || "",
      page: Number(searchParams.get("page") || 1),
    }),
    [searchParams]
  );

  useEffect(() => {
    Promise.all([
      listProperties({ limit: 100 }),
      listClients({ limit: 100 }),
      listPaymentMethods(),
    ])
      .then(([propsRes, clientsRes, methodsRes]) => {
        setProperties(propsRes.items || []);
        setClients(clientsRes.items || []);
        setMethods((methodsRes || []).filter((m) => m.isActive !== false));
      })
      .catch(() => {
        setProperties([]);
        setClients([]);
        setMethods([]);
      });
  }, []);

  // Initialize default date range once when missing
  useEffect(() => {
    if (searchParams.get("dateFrom") || searchParams.get("dateTo")) return;
    if (searchParams.get("preset") === "custom") return;
    const preset = searchParams.get("preset") || "this_month";
    const range = getDatePresetRange(preset);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    next.set("preset", preset);
    if (range.dateFrom) next.set("dateFrom", range.dateFrom);
    if (range.dateTo) next.set("dateTo", range.dateTo);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    const rangeError = validateDateRange(filters.dateFrom, filters.dateTo);
    if (rangeError) {
      setFilterError(rangeError);
      setLoading(false);
      setError("");
      setSummary(null);
      setItems([]);
      return;
    }
    setFilterError("");
    setLoading(true);
    setError("");
    try {
      const base = {
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        page: filters.page,
        limit: 20,
      };

      let data;
      if (tab === "bookings") {
        data = await fetchBookingsReport({
          ...base,
          status: filters.status || undefined,
          propertyId: filters.propertyId || undefined,
          clientId: filters.clientId || undefined,
        });
      } else if (tab === "payments") {
        data = await fetchPaymentsReport({
          ...base,
          bookingId: filters.bookingId || undefined,
          propertyId: filters.propertyId || undefined,
          clientId: filters.clientId || undefined,
          paymentMethodId: filters.paymentMethodId || undefined,
        });
      } else if (tab === "expenses") {
        data = await fetchExpensesReport({
          ...base,
          categoryId: filters.categoryId || undefined,
          propertyId: filters.propertyId || undefined,
          approvalStatus: filters.approvalStatus || undefined,
        });
      } else {
        data = await fetchPropertiesReport({
          ...base,
          status: filters.status || undefined,
          propertyType: filters.propertyType || undefined,
          purpose: filters.purpose || undefined,
          category: filters.category || undefined,
          city: filters.city || undefined,
        });
      }

      setSummary(data.summary);
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setSummary(null);
      setItems([]);
      setError(
        err instanceof ApiError ? formatApiError(err) : "Failed to load report"
      );
    } finally {
      setLoading(false);
    }
  }, [tab, filters]);

  useEffect(() => {
    load();
  }, [load]);

  function updateParams(patch, { resetPage = true } = {}) {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    if (resetPage) next.delete("page");
    setSearchParams(next);
  }

  function switchTab(nextTab) {
    const preset = filters.preset || "this_month";
    const range =
      preset === "custom"
        ? { dateFrom: filters.dateFrom, dateTo: filters.dateTo }
        : getDatePresetRange(preset);
    setSearchParams({
      tab: nextTab,
      preset,
      ...(range.dateFrom ? { dateFrom: range.dateFrom } : {}),
      ...(range.dateTo ? { dateTo: range.dateTo } : {}),
    });
  }

  function applyPreset(presetId) {
    if (presetId === "custom") {
      updateParams({ preset: "custom" });
      return;
    }
    const range = getDatePresetRange(presetId);
    updateParams({
      preset: presetId,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    });
  }

  function buildExportParams() {
    const base = {
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    };
    if (tab === "bookings") {
      return {
        ...base,
        status: filters.status || undefined,
        propertyId: filters.propertyId || undefined,
        clientId: filters.clientId || undefined,
      };
    }
    if (tab === "payments") {
      return {
        ...base,
        bookingId: filters.bookingId || undefined,
        propertyId: filters.propertyId || undefined,
        clientId: filters.clientId || undefined,
        paymentMethodId: filters.paymentMethodId || undefined,
      };
    }
    if (tab === "expenses") {
      return {
        ...base,
        categoryId: filters.categoryId || undefined,
        propertyId: filters.propertyId || undefined,
        approvalStatus: filters.approvalStatus || undefined,
      };
    }
    return {
      ...base,
      status: filters.status || undefined,
      propertyType: filters.propertyType || undefined,
      purpose: filters.purpose || undefined,
      category: filters.category || undefined,
      city: filters.city || undefined,
    };
  }

  async function handleExport(format) {
    const rangeError = validateDateRange(filters.dateFrom, filters.dateTo);
    if (rangeError) {
      setFilterError(rangeError);
      return;
    }
    setExportError("");
    setExporting(format);
    try {
      const params = { ...buildExportParams(), format };
      if (tab === "bookings") await downloadBookingsReport(params);
      else if (tab === "payments") await downloadPaymentsReport(params);
      else if (tab === "expenses") await downloadExpensesReport(params);
      else await downloadPropertiesReport(params);
    } catch (err) {
      setExportError(
        err instanceof ApiError ? formatApiError(err) : "Export failed"
      );
    } finally {
      setExporting("");
    }
  }

  const chartSeries = useMemo(() => {
    if (!summary) return [];
    if (tab === "bookings" && summary.byStatus) {
      return mapCountSeries(summary.byStatus, BOOKING_STATUSES);
    }
    if (tab === "expenses" && summary.byApprovalStatus) {
      return mapCountSeries(summary.byApprovalStatus, APPROVAL_STATUSES);
    }
    if (tab === "properties" && summary.byStatus) {
      return mapCountSeries(summary.byStatus, PROPERTY_STATUSES);
    }
    return [];
  }, [summary, tab]);

  return (
    <div className="reports-page properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Analytics</p>
          <h2 className="page-toolbar__title">Reports</h2>
          <p className="muted">
            Read-only summaries from the Reports API. Totals come from the
            backend. Export CSV (Excel-friendly) or PDF with the current
            filters.
          </p>
        </div>
        <div className="report-toolbar-actions">
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            disabled={Boolean(exporting) || Boolean(filterError)}
            onClick={() => handleExport("csv")}
          >
            {exporting === "csv" ? "Exporting…" : "Export CSV"}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--inline"
            disabled={Boolean(exporting) || Boolean(filterError)}
            onClick={() => handleExport("pdf")}
          >
            {exporting === "pdf" ? "Exporting…" : "Export PDF"}
          </button>
          <Link to="/dashboard" className="btn btn--ghost btn--inline">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="report-tabs" role="tablist" aria-label="Report type">
        {REPORT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`report-tab${tab === t.id ? " report-tab--active" : ""}`}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        className="filters-bar filters-bar--reports"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <select
          value={filters.preset}
          onChange={(e) => applyPreset(e.target.value)}
          aria-label="Date preset"
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) =>
            updateParams({
              dateFrom: e.target.value,
              preset: "custom",
            })
          }
          aria-label="From date"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) =>
            updateParams({
              dateTo: e.target.value,
              preset: "custom",
            })
          }
          aria-label="To date"
        />

        {tab === "bookings" ? (
          <>
            <select
              value={filters.status}
              onChange={(e) => updateParams({ status: e.target.value })}
              aria-label="Booking status"
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
              onChange={(e) => updateParams({ propertyId: e.target.value })}
              aria-label="Property"
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
              onChange={(e) => updateParams({ clientId: e.target.value })}
              aria-label="Client"
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.clientName || `Client #${c.id}`}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {tab === "payments" ? (
          <>
            <select
              value={filters.propertyId}
              onChange={(e) => updateParams({ propertyId: e.target.value })}
              aria-label="Property"
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
              onChange={(e) => updateParams({ clientId: e.target.value })}
              aria-label="Client"
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.clientName || `Client #${c.id}`}
                </option>
              ))}
            </select>
            <select
              value={filters.paymentMethodId}
              onChange={(e) =>
                updateParams({ paymentMethodId: e.target.value })
              }
              aria-label="Payment method"
            >
              <option value="">All methods</option>
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.methodName}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              placeholder="Booking ID"
              value={filters.bookingId}
              onChange={(e) => updateParams({ bookingId: e.target.value })}
              aria-label="Booking ID"
            />
          </>
        ) : null}

        {tab === "expenses" ? (
          <>
            <select
              value={filters.approvalStatus}
              onChange={(e) =>
                updateParams({ approvalStatus: e.target.value })
              }
              aria-label="Approval status"
            >
              <option value="">All approvals</option>
              {APPROVAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatLabel(s)}
                </option>
              ))}
            </select>
            <select
              value={filters.propertyId}
              onChange={(e) => updateParams({ propertyId: e.target.value })}
              aria-label="Property"
            >
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.propertyCode || `#${p.id}`} — {p.title}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              placeholder="Category ID"
              value={filters.categoryId}
              onChange={(e) => updateParams({ categoryId: e.target.value })}
              aria-label="Category ID"
            />
          </>
        ) : null}

        {tab === "properties" ? (
          <>
            <select
              value={filters.status}
              onChange={(e) => updateParams({ status: e.target.value })}
              aria-label="Property status"
            >
              <option value="">All statuses</option>
              {PROPERTY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatLabel(s)}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Type"
              value={filters.propertyType}
              onChange={(e) => updateParams({ propertyType: e.target.value })}
              aria-label="Property type"
            />
            <input
              type="text"
              placeholder="Purpose"
              value={filters.purpose}
              onChange={(e) => updateParams({ purpose: e.target.value })}
              aria-label="Purpose"
            />
            <input
              type="text"
              placeholder="Category"
              value={filters.category}
              onChange={(e) => updateParams({ category: e.target.value })}
              aria-label="Category"
            />
            <input
              type="text"
              placeholder="City"
              value={filters.city}
              onChange={(e) => updateParams({ city: e.target.value })}
              aria-label="City"
            />
          </>
        ) : null}

        <button type="submit" className="btn btn--ghost">
          Apply
        </button>
      </form>

      {filterError ? (
        <div className="alert alert--error" role="alert">
          {filterError}
        </div>
      ) : null}

      {exportError ? (
        <div className="alert alert--error" role="alert">
          {exportError}
        </div>
      ) : null}

      {loading ? (
        <div className="state-panel">
          <div className="spinner" aria-hidden="true" />
          <p>Loading report…</p>
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

      {!loading && !error && summary ? (
        <>
          <div className="stat-grid report-summary">
            {tab === "bookings" ? (
              <>
                <SummaryCard label="Bookings" value={summary.totalCount} />
                <SummaryCard
                  label="Booking value"
                  value={formatMoney(summary.totalBookingValue)}
                />
                <SummaryCard
                  label="Down payments"
                  value={formatMoney(summary.totalDownPayments)}
                />
                <SummaryCard
                  label="Remaining balance"
                  value={formatMoney(summary.totalRemainingBalance)}
                />
              </>
            ) : null}
            {tab === "payments" ? (
              <>
                <SummaryCard label="Payments" value={summary.totalCount} />
                <SummaryCard
                  label="Total amount"
                  value={formatMoney(summary.totalAmount)}
                />
              </>
            ) : null}
            {tab === "expenses" ? (
              <>
                <SummaryCard label="Expenses" value={summary.totalCount} />
                <SummaryCard
                  label="Total amount"
                  value={formatMoney(summary.totalAmount)}
                />
                <SummaryCard
                  label="Total GST"
                  value={formatMoney(summary.totalGst)}
                />
                <SummaryCard
                  label="Remaining"
                  value={formatMoney(summary.totalRemaining)}
                />
              </>
            ) : null}
            {tab === "properties" ? (
              <>
                <SummaryCard label="Properties" value={summary.totalCount} />
                <SummaryCard
                  label="Asking price total"
                  value={formatMoney(summary.totalAskingPrice)}
                />
              </>
            ) : null}
          </div>

          {chartSeries.length > 0 ? (
            <DistributionChart
              title={
                tab === "expenses"
                  ? "By approval status"
                  : "By status (backend counts)"
              }
              series={chartSeries}
            />
          ) : null}

          {summary.note ? (
            <p className="form-hint">{summary.note}</p>
          ) : null}

          {items.length === 0 ? (
            <div className="state-panel">
              <p>No records for this report filter.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    {tab === "bookings" ? (
                      <tr>
                        <th>Code</th>
                        <th>Property</th>
                        <th>Client</th>
                        <th>Amount</th>
                        <th>Remaining</th>
                        <th>Status</th>
                        <th>Booked</th>
                      </tr>
                    ) : null}
                    {tab === "payments" ? (
                      <tr>
                        <th>Code</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Booking</th>
                        <th>Client</th>
                      </tr>
                    ) : null}
                    {tab === "expenses" ? (
                      <tr>
                        <th>Code</th>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Approval</th>
                        <th>Property</th>
                      </tr>
                    ) : null}
                    {tab === "properties" ? (
                      <tr>
                        <th>Code</th>
                        <th>Title</th>
                        <th>Type</th>
                        <th>City</th>
                        <th>Asking price</th>
                        <th>Status</th>
                      </tr>
                    ) : null}
                  </thead>
                  <tbody>
                    {tab === "bookings"
                      ? items.map((row) => (
                          <tr key={row.id}>
                            <td className="mono">
                              <Link
                                to={`/bookings/${row.id}`}
                                className="linkish"
                              >
                                {row.bookingCode || `#${row.id}`}
                              </Link>
                            </td>
                            <td>
                              {row.propertyCode || "—"}
                              <div className="muted tiny">
                                {row.propertyTitle || ""}
                              </div>
                            </td>
                            <td>{row.clientName || "—"}</td>
                            <td>
                              {formatMoney(
                                row.bookingAmount ?? row.totalPrice
                              )}
                            </td>
                            <td>{formatMoney(row.remainingBalance)}</td>
                            <td>
                              <StatusBadge status={row.status} />
                            </td>
                            <td>
                              {row.bookedAt
                                ? String(row.bookedAt).slice(0, 10)
                                : "—"}
                            </td>
                          </tr>
                        ))
                      : null}
                    {tab === "payments"
                      ? items.map((row) => (
                          <tr key={row.id}>
                            <td className="mono">
                              <Link
                                to={`/payments/${row.id}`}
                                className="linkish"
                              >
                                {row.paymentCode || `#${row.id}`}
                              </Link>
                            </td>
                            <td>
                              {row.paymentDate
                                ? String(row.paymentDate).slice(0, 10)
                                : "—"}
                            </td>
                            <td>{formatMoney(row.amount)}</td>
                            <td>{row.paymentMethodName || "—"}</td>
                            <td className="mono">
                              {row.bookingId ? (
                                <Link
                                  to={`/bookings/${row.bookingId}`}
                                  className="linkish"
                                >
                                  {row.bookingCode || `#${row.bookingId}`}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>{row.clientName || "—"}</td>
                          </tr>
                        ))
                      : null}
                    {tab === "expenses"
                      ? items.map((row) => (
                          <tr key={row.id}>
                            <td className="mono">
                              <Link
                                to={`/expenses/${row.id}`}
                                className="linkish"
                              >
                                {row.expenseCode || `#${row.id}`}
                              </Link>
                            </td>
                            <td>
                              {row.expenseDate
                                ? String(row.expenseDate).slice(0, 10)
                                : "—"}
                            </td>
                            <td>{row.categoryName || "—"}</td>
                            <td>{formatMoney(row.amount)}</td>
                            <td>
                              <StatusBadge status={row.approvalStatus} />
                            </td>
                            <td className="mono">{row.propertyCode || "—"}</td>
                          </tr>
                        ))
                      : null}
                    {tab === "properties"
                      ? items.map((row) => (
                          <tr key={row.id}>
                            <td className="mono">
                              <Link
                                to={`/properties/${row.id}`}
                                className="linkish"
                              >
                                {row.propertyCode || `#${row.id}`}
                              </Link>
                            </td>
                            <td>{row.title || "—"}</td>
                            <td>{row.propertyType || "—"}</td>
                            <td>{row.city || "—"}</td>
                            <td>{formatMoney(row.askingPrice)}</td>
                            <td>
                              <StatusBadge status={row.status} />
                            </td>
                          </tr>
                        ))
                      : null}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <span className="muted">
                  {pagination.total} record
                  {pagination.total === 1 ? "" : "s"}
                </span>
                <div className="pagination__controls">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={filters.page <= 1}
                    onClick={() =>
                      updateParams({ page: filters.page - 1 }, { resetPage: false })
                    }
                  >
                    Previous
                  </button>
                  <span>
                    Page {pagination.page} of{" "}
                    {Math.max(pagination.totalPages, 1)}
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={filters.page >= pagination.totalPages}
                    onClick={() =>
                      updateParams({ page: filters.page + 1 }, { resetPage: false })
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
