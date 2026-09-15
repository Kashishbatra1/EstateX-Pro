/**
 * Reporting service — filtered listings + totals using existing schema.
 */
const pool = require("../config/db");
const {
  validateReportQuery,
  roundMoney,
  toNumber,
} = require("../utils/reportHelpers");
const {
  EXPORT_MAX_ROWS,
  buildExportFile,
  normalizeExportFormat,
} = require("../utils/reportExport");
const { toPublicBooking } = require("../utils/bookingMapper");
const { toPublicPayment } = require("../utils/paymentMapper");
const { toPublicExpense } = require("../utils/expenseMapper");
const { toPublicProperty } = require("../utils/propertyMapper");
const ApiError = require("../utils/ApiError");

function paginate(query, { forExport = false } = {}) {
  if (forExport) {
    return { pageNum: 1, limitNum: EXPORT_MAX_ROWS, offset: 0 };
  }
  const pageNum = Math.max(1, Number(query.page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { pageNum, limitNum, offset: (pageNum - 1) * limitNum };
}

async function bookingReport(rawQuery = {}, { forExport = false } = {}) {
  const query = validateReportQuery(rawQuery);
  const { pageNum, limitNum, offset } = paginate(query, { forExport });

  const where = ["b.deleted_at IS NULL"];
  const params = [];

  function add(sql, value) {
    params.push(value);
    where.push(sql.replace(/\?/g, `$${params.length}`));
  }

  if (query.status) add("b.status = ?", String(query.status).toLowerCase());
  if (query.propertyId) add("b.property_id = ?", query.propertyId);
  if (query.clientId) add("b.client_id = ?", query.clientId);
  if (query.dateFrom || query.bookedFrom) {
    add("b.booked_at::date >= ?", query.dateFrom || query.bookedFrom);
  }
  if (query.dateTo || query.bookedTo) {
    add("b.booked_at::date <= ?", query.dateTo || query.bookedTo);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const summary = await pool.query(
    `SELECT
       COUNT(*)::INT AS total_count,
       COALESCE(SUM(b.total_price), 0)::NUMERIC AS total_booking_value,
       COALESCE(SUM(b.booking_amount), 0)::NUMERIC AS total_down_payments,
       COALESCE(SUM(b.remaining_balance), 0)::NUMERIC AS total_remaining_balance,
       COUNT(*) FILTER (WHERE b.status = 'pending')::INT AS pending,
       COUNT(*) FILTER (WHERE b.status = 'confirmed')::INT AS confirmed,
       COUNT(*) FILTER (WHERE b.status = 'completed')::INT AS completed,
       COUNT(*) FILTER (WHERE b.status = 'cancelled')::INT AS cancelled
     FROM bookings b
     ${whereSql}`,
    params
  );

  const listParams = [...params, limitNum, offset];
  const list = await pool.query(
    `SELECT b.*,
            p.property_code,
            p.title AS property_title,
            p.status AS property_status,
            c.client_name
     FROM bookings b
     JOIN properties p ON p.id = b.property_id
     JOIN clients c ON c.id = b.client_id
     ${whereSql}
     ORDER BY b.booked_at DESC, b.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  const s = summary.rows[0];
  return {
    summary: {
      totalCount: toNumber(s.total_count),
      totalBookingValue: roundMoney(s.total_booking_value),
      totalDownPayments: roundMoney(s.total_down_payments),
      totalRemainingBalance: roundMoney(s.total_remaining_balance),
      byStatus: {
        pending: toNumber(s.pending),
        confirmed: toNumber(s.confirmed),
        completed: toNumber(s.completed),
        cancelled: toNumber(s.cancelled),
      },
    },
    items: list.rows.map((row) => toPublicBooking(row)),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: toNumber(s.total_count),
      totalPages: Math.ceil(toNumber(s.total_count) / limitNum) || 0,
    },
  };
}

async function paymentReport(rawQuery = {}, { forExport = false } = {}) {
  const query = validateReportQuery(rawQuery);
  const { pageNum, limitNum, offset } = paginate(query, { forExport });

  const where = ["pay.deleted_at IS NULL"];
  const params = [];

  function add(sql, value) {
    params.push(value);
    where.push(sql.replace(/\?/g, `$${params.length}`));
  }

  if (query.bookingId) add("pay.booking_id = ?", query.bookingId);
  if (query.propertyId) add("b.property_id = ?", query.propertyId);
  if (query.clientId) add("b.client_id = ?", query.clientId);
  if (query.paymentMethodId) add("pay.payment_method_id = ?", query.paymentMethodId);
  if (query.dateFrom || query.paymentFrom) {
    add("pay.payment_date >= ?", query.dateFrom || query.paymentFrom);
  }
  if (query.dateTo || query.paymentTo) {
    add("pay.payment_date <= ?", query.dateTo || query.paymentTo);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const fromSql = `
    FROM payments pay
    JOIN bookings b ON b.id = pay.booking_id
  `;

  const summary = await pool.query(
    `SELECT
       COUNT(*)::INT AS total_count,
       COALESCE(SUM(pay.amount), 0)::NUMERIC AS total_amount
     ${fromSql}
     ${whereSql}`,
    params
  );

  const listParams = [...params, limitNum, offset];
  const list = await pool.query(
    `SELECT pay.*,
            b.booking_code,
            b.status AS booking_status,
            b.property_id,
            b.client_id,
            b.remaining_balance,
            b.total_price,
            b.booking_amount,
            p.property_code,
            c.client_name,
            pm.method_name AS payment_method_name
     ${fromSql}
     JOIN properties p ON p.id = b.property_id
     JOIN clients c ON c.id = b.client_id
     LEFT JOIN payment_methods pm ON pm.id = pay.payment_method_id
     ${whereSql}
     ORDER BY pay.payment_date DESC, pay.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  const s = summary.rows[0];
  return {
    summary: {
      totalCount: toNumber(s.total_count),
      totalAmount: roundMoney(s.total_amount),
      note: "Totals exclude soft-deleted payments and do not include booking down payments",
    },
    items: list.rows.map((row) => toPublicPayment(row)),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: toNumber(s.total_count),
      totalPages: Math.ceil(toNumber(s.total_count) / limitNum) || 0,
    },
  };
}

async function expenseReport(rawQuery = {}, { forExport = false } = {}) {
  const query = validateReportQuery(rawQuery);
  const { pageNum, limitNum, offset } = paginate(query, { forExport });

  const where = ["e.deleted_at IS NULL"];
  const params = [];

  function add(sql, value) {
    params.push(value);
    where.push(sql.replace(/\?/g, `$${params.length}`));
  }

  if (query.categoryId) add("e.category_id = ?", query.categoryId);
  if (query.propertyId) add("e.property_id = ?", query.propertyId);
  if (query.vendorId) add("e.vendor_id = ?", query.vendorId);
  if (query.approvalStatus) {
    add("e.approval_status = ?", String(query.approvalStatus).toLowerCase());
  }
  if (query.dateFrom || query.expenseFrom) {
    add("e.expense_date >= ?", query.dateFrom || query.expenseFrom);
  }
  if (query.dateTo || query.expenseTo) {
    add("e.expense_date <= ?", query.dateTo || query.expenseTo);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const summary = await pool.query(
    `SELECT
       COUNT(*)::INT AS total_count,
       COALESCE(SUM(e.amount), 0)::NUMERIC AS total_amount,
       COALESCE(SUM(e.gst_sales_tax), 0)::NUMERIC AS total_gst,
       COALESCE(SUM(e.remaining_amount), 0)::NUMERIC AS total_remaining,
       COUNT(*) FILTER (WHERE e.approval_status = 'requested')::INT AS requested,
       COUNT(*) FILTER (WHERE e.approval_status = 'approved')::INT AS approved,
       COUNT(*) FILTER (WHERE e.approval_status = 'rejected')::INT AS rejected
     FROM expenses e
     ${whereSql}`,
    params
  );

  const listParams = [...params, limitNum, offset];
  const list = await pool.query(
    `SELECT e.*,
            cat.category_name,
            sub.subcategory_name,
            v.vendor_name,
            pm.method_name AS payment_method_name,
            emp.full_name AS paid_by_employee_name,
            p.property_code
     FROM expenses e
     JOIN expense_categories cat ON cat.id = e.category_id
     LEFT JOIN expense_subcategories sub ON sub.id = e.subcategory_id
     LEFT JOIN vendors v ON v.id = e.vendor_id
     LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
     JOIN employees emp ON emp.id = e.paid_by_employee_id
     LEFT JOIN properties p ON p.id = e.property_id
     ${whereSql}
     ORDER BY e.expense_date DESC, e.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  const s = summary.rows[0];
  return {
    summary: {
      totalCount: toNumber(s.total_count),
      totalAmount: roundMoney(s.total_amount),
      totalGst: roundMoney(s.total_gst),
      totalRemaining: roundMoney(s.total_remaining),
      byApprovalStatus: {
        requested: toNumber(s.requested),
        approved: toNumber(s.approved),
        rejected: toNumber(s.rejected),
      },
    },
    items: list.rows.map((row) => toPublicExpense(row)),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: toNumber(s.total_count),
      totalPages: Math.ceil(toNumber(s.total_count) / limitNum) || 0,
    },
  };
}

async function propertyReport(rawQuery = {}, { forExport = false } = {}) {
  const query = validateReportQuery(rawQuery);
  const { pageNum, limitNum, offset } = paginate(query, { forExport });

  const where = ["p.deleted_at IS NULL"];
  const params = [];

  function add(sql, value) {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  }

  if (query.status) add("p.status = ?", String(query.status).toLowerCase());
  if (query.propertyType) {
    params.push(String(query.propertyType).toLowerCase());
    where.push(`LOWER(p.property_type) = $${params.length}`);
  }
  if (query.purpose) add("p.purpose = ?", String(query.purpose).toLowerCase());
  if (query.category) add("p.category = ?", String(query.category).toLowerCase());
  if (query.city) {
    params.push(String(query.city).toLowerCase());
    where.push(`LOWER(p.city) = $${params.length}`);
  }
  if (query.dateFrom || query.createdFrom) {
    add("p.created_at::date >= ?", query.dateFrom || query.createdFrom);
  }
  if (query.dateTo || query.createdTo) {
    add("p.created_at::date <= ?", query.dateTo || query.createdTo);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const summary = await pool.query(
    `SELECT
       COUNT(*)::INT AS total_count,
       COUNT(*) FILTER (WHERE p.status = 'draft')::INT AS draft,
       COUNT(*) FILTER (WHERE p.status = 'available')::INT AS available,
       COUNT(*) FILTER (WHERE p.status = 'reserved')::INT AS reserved,
       COUNT(*) FILTER (WHERE p.status = 'sold')::INT AS sold,
       COUNT(*) FILTER (WHERE p.status = 'rented')::INT AS rented,
       COALESCE(SUM(p.asking_price), 0)::NUMERIC AS total_asking_price
     FROM properties p
     ${whereSql}`,
    params
  );

  const listParams = [...params, limitNum, offset];
  const list = await pool.query(
    `SELECT p.*
     FROM properties p
     ${whereSql}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  const s = summary.rows[0];
  return {
    summary: {
      totalCount: toNumber(s.total_count),
      totalAskingPrice: roundMoney(s.total_asking_price),
      byStatus: {
        draft: toNumber(s.draft),
        available: toNumber(s.available),
        reserved: toNumber(s.reserved),
        sold: toNumber(s.sold),
        rented: toNumber(s.rented),
      },
    },
    items: list.rows.map((row) => toPublicProperty(row)),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: toNumber(s.total_count),
      totalPages: Math.ceil(toNumber(s.total_count) / limitNum) || 0,
    },
  };
}

const REPORT_LOADERS = {
  bookings: bookingReport,
  payments: paymentReport,
  expenses: expenseReport,
  properties: propertyReport,
};

/**
 * Build a downloadable CSV or PDF for a report type using the same filters
 * as the JSON report endpoints.
 */
async function exportReport(reportType, rawQuery = {}) {
  const format = normalizeExportFormat(rawQuery.format);
  if (format !== "csv" && format !== "pdf") {
    throw new ApiError(400, "Validation failed", [
      { field: "format", message: "format must be csv or pdf" },
    ]);
  }

  const loader = REPORT_LOADERS[reportType];
  if (!loader) {
    throw new ApiError(400, "Unknown report type");
  }

  const result = await loader(rawQuery, { forExport: true });
  return buildExportFile(reportType, format, {
    summary: result.summary,
    items: result.items,
  });
}

module.exports = {
  bookingReport,
  paymentReport,
  expenseReport,
  propertyReport,
  exportReport,
};
