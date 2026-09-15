/**
 * Dashboard summary — EstateX Pro widgets & charts from existing schema only.
 * Spec: Total/Available/Sold/Rented/Reserved, Monthly Added, Total Clients,
 * Monthly Revenue, Monthly Expenses, Pending Bills, Recent Activities,
 * Property Status Distribution, Monthly Sales & Rentals, Expense Trends,
 * Category Distribution + suggested: Cash Flow, Top Areas, Commission Payable,
 * Document Expiry Alerts.
 */
const pool = require("../config/db");
const { roundMoney, toNumber } = require("../utils/reportHelpers");

function monthKey(d) {
  return String(d).slice(0, 7);
}

function lastNMonthKeys(n) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

function fillMonthSeries(keys, rowMap, valueKey = "value") {
  return keys.map((month) => ({
    month,
    label: month,
    value: roundMoney(rowMap.get(month)?.[valueKey] ?? 0),
  }));
}

async function getDashboard() {
  const monthKeys = lastNMonthKeys(6);

  const [
    properties,
    clients,
    bookings,
    bookingFinance,
    payments,
    expenses,
    monthlyAdded,
    monthlyRevenue,
    monthlyExpenses,
    pendingBills,
    salesRentals,
    expenseTrend,
    expenseCategories,
    recentActivities,
    cashFlowIn,
    cashFlowOut,
    recurringOut,
    topAreas,
    commissionPayable,
    documentExpiry,
  ] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE deleted_at IS NULL)::INT AS total,
         COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'available')::INT AS available,
         COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'reserved')::INT AS reserved,
         COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'sold')::INT AS sold,
         COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'rented')::INT AS rented,
         COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'draft')::INT AS draft
       FROM properties`
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE deleted_at IS NULL)::INT AS total,
         COUNT(*) FILTER (
           WHERE deleted_at IS NULL
             AND next_follow_up_date IS NOT NULL
             AND next_follow_up_date >= CURRENT_DATE
         )::INT AS with_upcoming_follow_up
       FROM clients`
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE deleted_at IS NULL)::INT AS total,
         COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'pending')::INT AS pending,
         COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'confirmed')::INT AS confirmed,
         COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'completed')::INT AS completed,
         COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'cancelled')::INT AS cancelled
       FROM bookings`
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(total_price) FILTER (
           WHERE deleted_at IS NULL AND status <> 'cancelled'
         ), 0)::NUMERIC AS total_booking_value,
         COALESCE(SUM(booking_amount) FILTER (
           WHERE deleted_at IS NULL AND status <> 'cancelled'
         ), 0)::NUMERIC AS total_down_payments,
         COALESCE(SUM(remaining_balance) FILTER (
           WHERE deleted_at IS NULL AND status IN ('pending', 'confirmed')
         ), 0)::NUMERIC AS remaining_receivables
       FROM bookings`
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0)::NUMERIC AS total_payments_received
       FROM payments
       WHERE deleted_at IS NULL`
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(amount), 0)::NUMERIC AS total_expenses,
         COALESCE(SUM(amount) FILTER (WHERE approval_status = 'approved'), 0)::NUMERIC AS total_approved_expenses
       FROM expenses
       WHERE deleted_at IS NULL`
    ),
    // Monthly added properties (current calendar month)
    pool.query(
      `SELECT COUNT(*)::INT AS count
       FROM properties
       WHERE deleted_at IS NULL
         AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)`
    ),
    // Monthly revenue = payments received this month
    pool.query(
      `SELECT COALESCE(SUM(amount), 0)::NUMERIC AS amount
       FROM payments
       WHERE deleted_at IS NULL
         AND payment_date >= date_trunc('month', CURRENT_DATE)::date`
    ),
    // Monthly expenses (current month)
    pool.query(
      `SELECT COALESCE(SUM(amount), 0)::NUMERIC AS amount
       FROM expenses
       WHERE deleted_at IS NULL
         AND expense_date >= date_trunc('month', CURRENT_DATE)::date`
    ),
    // Pending bills: unpaid expense balances + open installment balances
    pool.query(
      `SELECT
         (
           SELECT COALESCE(SUM(remaining_amount), 0)
           FROM expenses
           WHERE deleted_at IS NULL AND remaining_amount > 0
         )::NUMERIC AS expense_remaining,
         (
           SELECT COALESCE(SUM(amount_due - amount_paid), 0)
           FROM booking_installments bi
           INNER JOIN bookings b ON b.id = bi.booking_id
           WHERE b.deleted_at IS NULL
             AND b.status IN ('pending', 'confirmed')
             AND bi.status IN ('pending', 'partial', 'overdue')
             AND (bi.amount_due - bi.amount_paid) > 0
         )::NUMERIC AS installment_remaining,
         (
           SELECT COUNT(*)::INT
           FROM expenses
           WHERE deleted_at IS NULL AND remaining_amount > 0
         ) AS expense_bill_count,
         (
           SELECT COUNT(*)::INT
           FROM booking_installments bi
           INNER JOIN bookings b ON b.id = bi.booking_id
           WHERE b.deleted_at IS NULL
             AND b.status IN ('pending', 'confirmed')
             AND bi.status IN ('pending', 'partial', 'overdue')
             AND (bi.amount_due - bi.amount_paid) > 0
         ) AS installment_bill_count`
    ),
    // Monthly sales & rentals (last 6 months) by booking purpose
    pool.query(
      `SELECT
         to_char(date_trunc('month', COALESCE(b.booked_at, b.created_at)), 'YYYY-MM') AS month,
         COALESCE(SUM(b.total_price) FILTER (WHERE p.purpose = 'sale'), 0)::NUMERIC AS sales,
         COALESCE(SUM(b.total_price) FILTER (WHERE p.purpose = 'rent'), 0)::NUMERIC AS rentals,
         COUNT(*) FILTER (WHERE p.purpose = 'sale')::INT AS sales_count,
         COUNT(*) FILTER (WHERE p.purpose = 'rent')::INT AS rentals_count
       FROM bookings b
       INNER JOIN properties p ON p.id = b.property_id
       WHERE b.deleted_at IS NULL
         AND b.status <> 'cancelled'
         AND COALESCE(b.booked_at, b.created_at) >= date_trunc('month', CURRENT_TIMESTAMP) - INTERVAL '5 months'
       GROUP BY 1
       ORDER BY 1`
    ),
    // Expense trends last 6 months
    pool.query(
      `SELECT
         to_char(date_trunc('month', expense_date), 'YYYY-MM') AS month,
         COALESCE(SUM(amount), 0)::NUMERIC AS amount
       FROM expenses
       WHERE deleted_at IS NULL
         AND expense_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')::date
       GROUP BY 1
       ORDER BY 1`
    ),
    // Expense category distribution (all active expenses)
    pool.query(
      `SELECT
         COALESCE(c.category_name, 'Uncategorized') AS label,
         COALESCE(SUM(e.amount), 0)::NUMERIC AS value
       FROM expenses e
       LEFT JOIN expense_categories c ON c.id = e.category_id
       WHERE e.deleted_at IS NULL
       GROUP BY 1
       ORDER BY value DESC
       LIMIT 10`
    ),
    // Recent activities from audit log
    pool.query(
      `SELECT
         a.id,
         a.action,
         a.entity_type AS "entityType",
         a.entity_id AS "entityId",
         a.created_at AS "createdAt",
         adm.full_name AS "adminName"
       FROM audit_logs a
       LEFT JOIN admins adm ON adm.id = a.admin_id
       ORDER BY a.created_at DESC
       LIMIT 12`
    ),
    // Cash flow inflow next 30/90 days (installments remaining)
    pool.query(
      `SELECT
         COALESCE(SUM(bi.amount_due - bi.amount_paid) FILTER (
           WHERE bi.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
         ), 0)::NUMERIC AS next_30,
         COALESCE(SUM(bi.amount_due - bi.amount_paid) FILTER (
           WHERE bi.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
         ), 0)::NUMERIC AS next_90
       FROM booking_installments bi
       INNER JOIN bookings b ON b.id = bi.booking_id
       WHERE b.deleted_at IS NULL
         AND b.status IN ('pending', 'confirmed')
         AND bi.status IN ('pending', 'partial', 'overdue')
         AND (bi.amount_due - bi.amount_paid) > 0`
    ),
    // Cash flow outflow: expense remaining due now (pending bills)
    pool.query(
      `SELECT COALESCE(SUM(remaining_amount), 0)::NUMERIC AS pending_expense_outflow
       FROM expenses
       WHERE deleted_at IS NULL AND remaining_amount > 0`
    ),
    // Recurring due in next 30/90 days
    pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (
           WHERE next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
         ), 0)::NUMERIC AS next_30,
         COALESCE(SUM(amount) FILTER (
           WHERE next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
         ), 0)::NUMERIC AS next_90
       FROM recurring_expenses
       WHERE deleted_at IS NULL
         AND is_active = TRUE
         AND next_due_date IS NOT NULL`
    ),
    // Top performing areas / societies by booking sales value
    pool.query(
      `SELECT
         COALESCE(NULLIF(TRIM(p.society), ''), NULLIF(TRIM(p.area), ''), NULLIF(TRIM(p.city), ''), 'Unknown') AS area,
         COALESCE(SUM(b.total_price), 0)::NUMERIC AS "salesValue",
         COUNT(*)::INT AS bookings
       FROM bookings b
       INNER JOIN properties p ON p.id = b.property_id
       WHERE b.deleted_at IS NULL
         AND b.status <> 'cancelled'
       GROUP BY 1
       ORDER BY "salesValue" DESC
       LIMIT 8`
    ),
    // Commission payable (unpaid / partial)
    pool.query(
      `SELECT
         COALESCE(SUM(COALESCE(final_amount, calculated_amount, 0)), 0)::NUMERIC AS total,
         COUNT(*)::INT AS count
       FROM commissions
       WHERE deleted_at IS NULL
         AND payment_status IN ('unpaid', 'partial')`
    ),
    // Document expiry alerts (next 45 days) from approved tables
    pool.query(
      `(
         SELECT
           'property_document'::TEXT AS source,
           d.id,
           COALESCE(d.document_name, d.document_type::TEXT, 'Property document') AS title,
           d.expiry_date AS "expiryDate",
           p.title AS context,
           ('/properties/' || p.id::TEXT) AS path
         FROM property_documents d
         INNER JOIN properties p ON p.id = d.property_id
         WHERE d.deleted_at IS NULL
           AND p.deleted_at IS NULL
           AND d.expiry_date IS NOT NULL
           AND d.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '45 days'
       )
       UNION ALL
       (
         SELECT
           'client_kyc'::TEXT,
           d.id,
           COALESCE(d.document_type, 'KYC document'),
           d.expiry_date,
           c.client_name,
           ('/clients/' || c.id::TEXT)
         FROM client_kyc_documents d
         INNER JOIN clients c ON c.id = d.client_id
         WHERE d.deleted_at IS NULL
           AND c.deleted_at IS NULL
           AND d.expiry_date IS NOT NULL
           AND d.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '45 days'
       )
       UNION ALL
       (
         SELECT
           'vendor_document'::TEXT,
           d.id,
           COALESCE(d.document_name, d.document_type, 'Vendor document'),
           d.expiry_date,
           v.vendor_name,
           ('/vendors/' || v.id::TEXT)
         FROM vendor_documents d
         INNER JOIN vendors v ON v.id = d.vendor_id
         WHERE d.deleted_at IS NULL
           AND v.deleted_at IS NULL
           AND d.expiry_date IS NOT NULL
           AND d.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '45 days'
       )
       ORDER BY "expiryDate" ASC
       LIMIT 10`
    ),
  ]);

  const prop = properties.rows[0];
  const cli = clients.rows[0];
  const book = bookings.rows[0];
  const fin = bookingFinance.rows[0];
  const pay = payments.rows[0];
  const exp = expenses.rows[0];
  const bills = pendingBills.rows[0];
  const cashIn = cashFlowIn.rows[0];
  const cashOutExp = cashFlowOut.rows[0];
  const cashOutRec = recurringOut.rows[0];
  const commission = commissionPayable.rows[0];

  const salesMap = new Map(
    salesRentals.rows.map((r) => [monthKey(r.month), r])
  );
  const expenseMap = new Map(
    expenseTrend.rows.map((r) => [monthKey(r.month), r])
  );

  const monthlySalesRentals = monthKeys.map((month) => {
    const row = salesMap.get(month);
    return {
      month,
      label: month,
      sales: roundMoney(row?.sales ?? 0),
      rentals: roundMoney(row?.rentals ?? 0),
      salesCount: toNumber(row?.sales_count),
      rentalsCount: toNumber(row?.rentals_count),
    };
  });

  const expenseTrends = fillMonthSeries(monthKeys, expenseMap, "amount");

  const pendingBillsTotal =
    Number(bills.expense_remaining || 0) + Number(bills.installment_remaining || 0);

  const next30Outflow =
    Number(cashOutExp.pending_expense_outflow || 0) + Number(cashOutRec.next_30 || 0);
  const next90Outflow =
    Number(cashOutExp.pending_expense_outflow || 0) + Number(cashOutRec.next_90 || 0);

  return {
    properties: {
      total: toNumber(prop.total),
      available: toNumber(prop.available),
      reserved: toNumber(prop.reserved),
      sold: toNumber(prop.sold),
      rented: toNumber(prop.rented),
      draft: toNumber(prop.draft),
      monthlyAdded: toNumber(monthlyAdded.rows[0]?.count),
    },
    clients: {
      total: toNumber(cli.total),
      active: toNumber(cli.total),
      withUpcomingFollowUp: toNumber(cli.with_upcoming_follow_up),
    },
    bookings: {
      total: toNumber(book.total),
      pending: toNumber(book.pending),
      confirmed: toNumber(book.confirmed),
      completed: toNumber(book.completed),
      cancelled: toNumber(book.cancelled),
    },
    financials: {
      totalBookingValue: roundMoney(fin.total_booking_value),
      totalDownPayments: roundMoney(fin.total_down_payments),
      totalPaymentsReceived: roundMoney(pay.total_payments_received),
      remainingReceivables: roundMoney(fin.remaining_receivables),
      totalExpenses: roundMoney(exp.total_expenses),
      totalApprovedExpenses: roundMoney(exp.total_approved_expenses),
      monthlyRevenue: roundMoney(monthlyRevenue.rows[0]?.amount),
      monthlyExpenses: roundMoney(monthlyExpenses.rows[0]?.amount),
      pendingBills: roundMoney(pendingBillsTotal),
      pendingBillCount:
        toNumber(bills.expense_bill_count) + toNumber(bills.installment_bill_count),
      notes: {
        downPaymentModel:
          "Down payments live on bookings.booking_amount and are excluded from payments totals",
        remainingModel:
          "remaining_balance = total_price - booking_amount - SUM(active payments)",
        monthlyRevenueModel: "Sum of payments.payment_date in the current calendar month",
        monthlyExpensesModel: "Sum of expenses.expense_date in the current calendar month",
        pendingBillsModel:
          "Expense remaining_amount + open installment balances on active bookings",
      },
    },
    charts: {
      propertyStatus: [
        { label: "Available", value: toNumber(prop.available) },
        { label: "Reserved", value: toNumber(prop.reserved) },
        { label: "Sold", value: toNumber(prop.sold) },
        { label: "Rented", value: toNumber(prop.rented) },
        { label: "Draft", value: toNumber(prop.draft) },
      ],
      monthlySalesRentals,
      expenseTrends,
      expenseCategories: expenseCategories.rows.map((r) => ({
        label: r.label,
        value: roundMoney(r.value),
      })),
    },
    widgets: {
      recentActivities: recentActivities.rows.map((r) => ({
        id: Number(r.id),
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId != null ? Number(r.entityId) : null,
        adminName: r.adminName || null,
        createdAt: r.createdAt,
      })),
      cashFlowForecast: {
        next30Inflow: roundMoney(cashIn.next_30),
        next30Outflow: roundMoney(next30Outflow),
        next90Inflow: roundMoney(cashIn.next_90),
        next90Outflow: roundMoney(next90Outflow),
        net30: roundMoney(Number(cashIn.next_30 || 0) - next30Outflow),
        net90: roundMoney(Number(cashIn.next_90 || 0) - next90Outflow),
      },
      topPerformingAreas: topAreas.rows.map((r) => ({
        area: r.area,
        salesValue: roundMoney(r.salesValue),
        bookings: toNumber(r.bookings),
      })),
      commissionPayable: {
        total: roundMoney(commission.total),
        count: toNumber(commission.count),
      },
      documentExpiryAlerts: documentExpiry.rows.map((r) => ({
        source: r.source,
        id: Number(r.id),
        title: r.title,
        expiryDate: r.expiryDate
          ? String(r.expiryDate).slice(0, 10)
          : null,
        context: r.context || null,
        path: r.path || null,
      })),
    },
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getDashboard,
};
