import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDashboard } from "../api/dashboard.js";
import { ApiError } from "../api/client.js";
import { formatMoney } from "../utils/format.js";
import DistributionChart from "../components/reports/DistributionChart.jsx";
import TrendChart from "../components/reports/TrendChart.jsx";
import { formatApiError } from "../utils/reportHelpers.js";
import "../styles/dashboard.css";
import "../styles/reports.css";

function StatCard({ label, value, tone = "default", hint, to }) {
  const body = (
    <article className={`stat-card stat-card--${tone}`}>
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{value}</p>
      <p className="stat-card__hint">{hint || "\u00a0"}</p>
    </article>
  );
  if (to) {
    return (
      <Link to={to} className="stat-card-link">
        {body}
      </Link>
    );
  }
  return body;
}

function Section({ title, children, className = "", action }) {
  return (
    <section className={`dash-section ${className}`.trim()}>
      <div className="dash-section__head">
        <h2 className="dash-section__title">{title}</h2>
        {action || null}
      </div>
      {children}
    </section>
  );
}

function formatAction(action) {
  return String(action || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const QUICK_LINKS = [
  { to: "/properties/new", label: "Add property" },
  { to: "/bookings/new", label: "New booking" },
  { to: "/payments/new", label: "Record payment" },
  { to: "/expenses/new", label: "Add expense" },
  { to: "/clients/new", label: "Add client" },
  { to: "/reports", label: "Open reports" },
];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const dashboard = await fetchDashboard();
        if (!cancelled) setData(dashboard);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(
            err instanceof ApiError
              ? formatApiError(err)
              : "Failed to load dashboard"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="state-panel">
        <div className="spinner" aria-hidden="true" />
        <p>Loading dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{error}</p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="state-panel">
        <p>No dashboard data available yet.</p>
      </div>
    );
  }

  const {
    properties,
    clients,
    bookings,
    financials,
    charts = {},
    widgets = {},
    generatedAt,
  } = data;

  const propertySeries =
    charts.propertyStatus ||
    [
      { label: "Available", value: properties.available },
      { label: "Reserved", value: properties.reserved },
      { label: "Sold", value: properties.sold },
      { label: "Rented", value: properties.rented },
      { label: "Draft", value: properties.draft },
    ];

  const salesRentals = charts.monthlySalesRentals || [];
  const expenseTrends = charts.expenseTrends || [];
  const expenseCategories = charts.expenseCategories || [];
  const recent = widgets.recentActivities || [];
  const cash = widgets.cashFlowForecast || {};
  const topAreas = widgets.topPerformingAreas || [];
  const commission = widgets.commissionPayable || {};
  const docAlerts = widgets.documentExpiryAlerts || [];

  return (
    <div className="dashboard">
      <div className="dashboard__hero">
        <div>
          <p className="dashboard__kicker">Operations command center</p>
          <h2 className="dashboard__heading">Estate overview</h2>
          <p className="dashboard__intro">
            Live widgets and charts from EstateX Pro inventory, bookings,
            payments, and expenses.
          </p>
          {generatedAt ? (
            <p className="muted tiny">
              Snapshot {new Date(generatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="dashboard__quick">
          {QUICK_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="dashboard__chip">
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <Section title="Core widgets">
        <div className="stat-grid">
          <StatCard label="Total properties" value={properties.total} to="/properties" />
          <StatCard
            label="Available"
            value={properties.available}
            tone="positive"
            to="/properties?status=available"
          />
          <StatCard
            label="Sold"
            value={properties.sold}
            to="/properties?status=sold"
          />
          <StatCard
            label="Rented"
            value={properties.rented}
            to="/properties?status=rented"
          />
          <StatCard
            label="Reserved"
            value={properties.reserved}
            tone="warn"
            to="/properties?status=reserved"
          />
          <StatCard
            label="Monthly added"
            value={properties.monthlyAdded ?? 0}
            hint="Properties created this month"
          />
        </div>
        <div className="stat-grid stat-grid--4" style={{ marginTop: "0.85rem" }}>
          <StatCard
            label="Total clients"
            value={clients.total}
            hint="All active clients"
            to="/clients"
          />
          <StatCard
            label="Monthly revenue"
            value={formatMoney(financials.monthlyRevenue ?? 0)}
            tone="positive"
            hint="Payments received this month"
            to="/payments"
          />
          <StatCard
            label="Monthly expenses"
            value={formatMoney(financials.monthlyExpenses ?? 0)}
            hint="Expenses dated this month"
            to="/expenses"
          />
          <StatCard
            label="Pending bills"
            value={formatMoney(financials.pendingBills ?? 0)}
            tone="warn"
            hint={
              financials.pendingBillCount
                ? `${financials.pendingBillCount} open balances`
                : "Expense remainders + installment dues"
            }
            to="/expenses"
          />
        </div>
      </Section>

      <Section title="Charts">
        <div className="dash-charts__grid">
          <DistributionChart
            title="Property status distribution"
            series={propertySeries}
            emptyLabel="No properties yet"
          />
          <TrendChart
            title="Monthly sales & rentals"
            series={salesRentals}
            mode="dual"
            formatValue={formatMoney}
            emptyLabel="No sales or rentals in the last 6 months"
          />
          <TrendChart
            title="Expense trends"
            series={expenseTrends}
            mode="single"
            formatValue={formatMoney}
            emptyLabel="No expenses in the last 6 months"
          />
          <DistributionChart
            title="Expense category distribution"
            series={expenseCategories}
            emptyLabel="No categorized expenses yet"
          />
        </div>
      </Section>

      <Section
        title="Recent activities"
        action={
          <Link to="/audit-logs" className="btn btn--ghost btn--inline">
            Audit log
          </Link>
        }
      >
        {recent.length === 0 ? (
          <p className="muted">No recent activity recorded yet.</p>
        ) : (
          <ul className="dash-activity">
            {recent.map((item) => (
              <li key={item.id} className="dash-activity__item">
                <div>
                  <strong>{formatAction(item.action)}</strong>
                  <div className="muted tiny">
                    {item.entityType || "system"}
                    {item.entityId != null ? ` #${item.entityId}` : ""}
                    {item.adminName ? ` · ${item.adminName}` : ""}
                  </div>
                </div>
                <time className="muted tiny">
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleString()
                    : "—"}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Suggested widgets">
        <div className="dash-widget-grid">
          <article className="dash-widget">
            <h3 className="dash-widget__title">Cash flow forecast</h3>
            <dl className="dash-widget__stats">
              <div>
                <dt>Next 30 days in</dt>
                <dd>{formatMoney(cash.next30Inflow ?? 0)}</dd>
              </div>
              <div>
                <dt>Next 30 days out</dt>
                <dd>{formatMoney(cash.next30Outflow ?? 0)}</dd>
              </div>
              <div>
                <dt>Net 30 days</dt>
                <dd className={(cash.net30 ?? 0) < 0 ? "text-warn" : undefined}>
                  {formatMoney(cash.net30 ?? 0)}
                </dd>
              </div>
              <div>
                <dt>Net 90 days</dt>
                <dd className={(cash.net90 ?? 0) < 0 ? "text-warn" : undefined}>
                  {formatMoney(cash.net90 ?? 0)}
                </dd>
              </div>
            </dl>
            <p className="muted tiny">
              Inflows from installment dues; outflows from unpaid expense balances
              and recurring dues.
            </p>
          </article>

          <article className="dash-widget">
            <div className="dash-widget__head">
              <h3 className="dash-widget__title">Top performing areas</h3>
              <Link to="/reports" className="btn btn--tiny btn--ghost">
                Reports
              </Link>
            </div>
            {topAreas.length === 0 ? (
              <p className="muted">No booking sales by area yet.</p>
            ) : (
              <ul className="dash-rank">
                {topAreas.map((row) => (
                  <li key={row.area}>
                    <span>{row.area}</span>
                    <strong>{formatMoney(row.salesValue)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="dash-widget">
            <div className="dash-widget__head">
              <h3 className="dash-widget__title">Commission payable</h3>
              <Link to="/commissions?paymentStatus=unpaid" className="btn btn--tiny btn--ghost">
                Open
              </Link>
            </div>
            <p className="dash-widget__hero">{formatMoney(commission.total ?? 0)}</p>
            <p className="muted tiny">
              {commission.count ?? 0} unpaid / partial commission record
              {(commission.count ?? 0) === 1 ? "" : "s"}
            </p>
          </article>

          <article className="dash-widget">
            <div className="dash-widget__head">
              <h3 className="dash-widget__title">Document expiry alerts</h3>
              <Link to="/notifications" className="btn btn--tiny btn--ghost">
                Alerts
              </Link>
            </div>
            {docAlerts.length === 0 ? (
              <p className="muted">No documents expiring in the next 45 days.</p>
            ) : (
              <ul className="dash-alerts">
                {docAlerts.map((doc) => (
                  <li key={`${doc.source}-${doc.id}`}>
                    <div>
                      {doc.path ? (
                        <Link to={doc.path}>{doc.title}</Link>
                      ) : (
                        <strong>{doc.title}</strong>
                      )}
                      <div className="muted tiny">
                        {doc.context || doc.source}
                        {doc.expiryDate ? ` · expires ${doc.expiryDate}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </Section>

      <Section title="Also tracking">
        <div className="stat-grid stat-grid--4">
          <StatCard label="Total bookings" value={bookings.total} to="/bookings" />
          <StatCard
            label="Pending bookings"
            value={bookings.pending}
            tone="warn"
            to="/bookings?status=pending"
          />
          <StatCard
            label="Payments received (all time)"
            value={formatMoney(financials.totalPaymentsReceived)}
            to="/payments"
          />
          <StatCard
            label="Remaining receivables"
            value={formatMoney(financials.remainingReceivables)}
            tone="accent"
            to="/bookings"
          />
        </div>
      </Section>
    </div>
  );
}
