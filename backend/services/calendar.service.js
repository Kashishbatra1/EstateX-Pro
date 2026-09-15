/**
 * Booking Calendar — aggregate property visits, booking/payment/contract dates,
 * installments, booking expiry, and client follow-ups (plus related office dates).
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function parseTypeFilter(query) {
  const raw = query.eventType || query.type || query.types;
  if (!raw) return null;
  const list = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? new Set(list) : null;
}

function pushIf(events, typeFilter, event) {
  if (typeFilter && !typeFilter.has(event.eventType)) return;
  events.push(event);
}

function dateWhere(column, from, to, params) {
  const clauses = [];
  if (from) {
    params.push(from);
    clauses.push(`${column} >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`${column} <= $${params.length}`);
  }
  return clauses;
}

async function getCalendarEvents(query = {}) {
  const from = query.from ? String(query.from).slice(0, 10) : null;
  const to = query.to ? String(query.to).slice(0, 10) : null;
  const typeFilter = parseTypeFilter(query);

  if (from && Number.isNaN(new Date(from).getTime())) {
    throw new ApiError(400, "Invalid from date");
  }
  if (to && Number.isNaN(new Date(to).getTime())) {
    throw new ApiError(400, "Invalid to date");
  }
  if (from && to && from > to) {
    throw new ApiError(400, "from must be on or before to");
  }

  const events = [];

  // 1) Property visits
  if (!typeFilter || typeFilter.has("property_visit")) {
    try {
      const params = [];
      const where = ["v.deleted_at IS NULL"];
      where.push(...dateWhere("v.visit_date", from, to, params));
      const result = await pool.query(
        `SELECT v.id, v.visit_date, v.visit_time, v.status, v.notes,
                v.property_id, p.title AS property_title, p.property_code,
                c.client_name
         FROM property_visits v
         JOIN properties p ON p.id = v.property_id AND p.deleted_at IS NULL
         LEFT JOIN clients c ON c.id = v.client_id AND c.deleted_at IS NULL
         WHERE ${where.join(" AND ")}
         ORDER BY v.visit_date ASC
         LIMIT 500`,
        params
      );
      for (const row of result.rows) {
        const time =
          row.visit_time != null ? String(row.visit_time).slice(0, 5) : null;
        pushIf(events, typeFilter, {
          id: `property-visit-${row.id}`,
          eventType: "property_visit",
          date: toDateOnly(row.visit_date),
          title: `Visit: ${row.property_title || row.property_code || `#${row.property_id}`}`,
          subtitle: [row.client_name, time, row.status]
            .filter(Boolean)
            .join(" · "),
          entityType: "property_visit",
          entityId: Number(row.id),
          status: row.status,
          path: `/properties/${row.property_id}`,
        });
      }
    } catch (err) {
      if (err.code !== "42P01") throw err;
    }
  }

  // 2) Booking dates (booked_at)
  if (!typeFilter || typeFilter.has("booking_date")) {
    const params = [];
    const where = ["b.deleted_at IS NULL"];
    where.push(...dateWhere("b.booked_at::date", from, to, params));
    const result = await pool.query(
      `SELECT b.id, b.booking_code, b.booked_at, b.status, p.title AS property_title
       FROM bookings b
       LEFT JOIN properties p ON p.id = b.property_id
       WHERE ${where.join(" AND ")}
       ORDER BY b.booked_at ASC
       LIMIT 500`,
      params
    );
    for (const row of result.rows) {
      pushIf(events, typeFilter, {
        id: `booking-date-${row.id}`,
        eventType: "booking_date",
        date: toDateOnly(row.booked_at),
        title: `Booking: ${row.booking_code}`,
        subtitle: row.property_title || null,
        entityType: "booking",
        entityId: Number(row.id),
        status: row.status,
        path: `/bookings/${row.id}`,
      });
    }
  }

  // 3) Installment dates / payment schedule (due dates)
  if (
    !typeFilter ||
    typeFilter.has("installment_due") ||
    typeFilter.has("payment_schedule")
  ) {
    const params = [];
    const where = ["b.deleted_at IS NULL"];
    where.push(...dateWhere("i.due_date", from, to, params));
    const result = await pool.query(
      `SELECT i.id, i.due_date, i.amount_due, i.status, i.installment_number,
              b.id AS booking_id, b.booking_code
       FROM booking_installments i
       JOIN bookings b ON b.id = i.booking_id
       WHERE ${where.join(" AND ")}
       ORDER BY i.due_date ASC
       LIMIT 500`,
      params
    );
    for (const row of result.rows) {
      const base = {
        date: toDateOnly(row.due_date),
        title: `Installment #${row.installment_number}: ${row.booking_code}`,
        subtitle:
          row.amount_due != null ? `Due ${Number(row.amount_due)}` : null,
        entityType: "booking",
        entityId: Number(row.booking_id),
        status: row.status,
        path: `/bookings/${row.booking_id}`,
      };
      // Emit under both labels so filters match the product glossary
      if (!typeFilter || typeFilter.has("installment_due")) {
        pushIf(events, typeFilter, {
          ...base,
          id: `installment-${row.id}`,
          eventType: "installment_due",
        });
      }
      if (!typeFilter || typeFilter.has("payment_schedule")) {
        // Avoid duplicate rows when no filter / both requested — only add
        // payment_schedule when filter asks for it specifically, OR when
        // no filter (then installment_due alone is enough). When filter is
        // payment_schedule only, emit that type.
        if (typeFilter && typeFilter.has("payment_schedule")) {
          pushIf(events, typeFilter, {
            ...base,
            id: `payment-schedule-${row.id}`,
            eventType: "payment_schedule",
            title: `Payment schedule #${row.installment_number}: ${row.booking_code}`,
          });
        }
      }
    }
  }

  // 4) Actual payments (payment schedule recorded)
  if (!typeFilter || typeFilter.has("payment_schedule") || typeFilter.has("payment")) {
    const params = [];
    const where = ["pay.deleted_at IS NULL"];
    where.push(...dateWhere("pay.payment_date", from, to, params));
    const result = await pool.query(
      `SELECT pay.id, pay.payment_code, pay.payment_date, pay.amount,
              b.id AS booking_id, b.booking_code
       FROM payments pay
       LEFT JOIN bookings b ON b.id = pay.booking_id
       WHERE ${where.join(" AND ")}
       ORDER BY pay.payment_date ASC
       LIMIT 500`,
      params
    );
    for (const row of result.rows) {
      pushIf(events, typeFilter, {
        id: `payment-${row.id}`,
        eventType: typeFilter && typeFilter.has("payment") && !typeFilter.has("payment_schedule")
          ? "payment"
          : "payment_schedule",
        date: toDateOnly(row.payment_date),
        title: `Payment: ${row.payment_code || `#${row.id}`}`,
        subtitle: [
          row.booking_code,
          row.amount != null ? `Amount ${Number(row.amount)}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        entityType: "payment",
        entityId: Number(row.id),
        path: `/payments/${row.id}`,
      });
    }
  }

  // 5) Contract dates — vendor start + agreement/lease document expiry
  //    Vendor contract end remains eventType vendor_contract_renewal (existing API).
  if (
    !typeFilter ||
    typeFilter.has("contract_date") ||
    typeFilter.has("vendor_contract_renewal")
  ) {
    {
      const params = [];
      const where = ["v.deleted_at IS NULL", "v.contract_start_date IS NOT NULL"];
      where.push(...dateWhere("v.contract_start_date", from, to, params));
      const result = await pool.query(
        `SELECT v.id, v.vendor_name, v.contract_start_date
         FROM vendors v
         WHERE ${where.join(" AND ")}
         ORDER BY v.contract_start_date ASC
         LIMIT 200`,
        params
      );
      for (const row of result.rows) {
        pushIf(events, typeFilter, {
          id: `vendor-contract-start-${row.id}`,
          eventType: "contract_date",
          date: toDateOnly(row.contract_start_date),
          title: `Contract start: ${row.vendor_name}`,
          subtitle: "Vendor contract",
          entityType: "vendor",
          entityId: Number(row.id),
          path: `/vendors/${row.id}`,
        });
      }
    }
    {
      const params = [];
      const where = ["v.deleted_at IS NULL", "v.contract_end_date IS NOT NULL"];
      where.push(...dateWhere("v.contract_end_date", from, to, params));
      const result = await pool.query(
        `SELECT v.id, v.vendor_name, v.contract_end_date
         FROM vendors v
         WHERE ${where.join(" AND ")}
         ORDER BY v.contract_end_date ASC
         LIMIT 200`,
        params
      );
      for (const row of result.rows) {
        pushIf(events, typeFilter, {
          id: `vendor-contract-${row.id}`,
          eventType: "vendor_contract_renewal",
          date: toDateOnly(row.contract_end_date),
          title: `Contract: ${row.vendor_name}`,
          subtitle: "Vendor contract end",
          entityType: "vendor",
          entityId: Number(row.id),
          path: `/vendors/${row.id}`,
        });
      }
    }
    {
      const params = [];
      const where = [
        "d.deleted_at IS NULL",
        "d.expiry_date IS NOT NULL",
        "d.document_type IN ('agreement', 'lease_certificate')",
      ];
      where.push(...dateWhere("d.expiry_date", from, to, params));
      const result = await pool.query(
        `SELECT d.id, d.document_name, d.document_type, d.expiry_date, d.property_id,
                p.title AS property_title
         FROM property_documents d
         JOIN properties p ON p.id = d.property_id AND p.deleted_at IS NULL
         WHERE ${where.join(" AND ")}
         ORDER BY d.expiry_date ASC
         LIMIT 200`,
        params
      );
      for (const row of result.rows) {
        pushIf(events, typeFilter, {
          id: `contract-doc-${row.id}`,
          eventType: "contract_date",
          date: toDateOnly(row.expiry_date),
          title: row.document_name || row.document_type || "Contract document",
          subtitle: row.property_title || null,
          entityType: "property_document",
          entityId: Number(row.id),
          path: `/properties/${row.property_id}`,
        });
      }
    }
  }

  // 6) Booking expiry
  if (!typeFilter || typeFilter.has("booking_expiry")) {
    const params = [];
    const where = ["b.deleted_at IS NULL", "b.booking_expiry_date IS NOT NULL"];
    where.push(...dateWhere("b.booking_expiry_date", from, to, params));
    const result = await pool.query(
      `SELECT b.id, b.booking_code, b.booking_expiry_date, b.status, p.title AS property_title
       FROM bookings b
       LEFT JOIN properties p ON p.id = b.property_id
       WHERE ${where.join(" AND ")}
       ORDER BY b.booking_expiry_date ASC
       LIMIT 500`,
      params
    );
    for (const row of result.rows) {
      pushIf(events, typeFilter, {
        id: `booking-expiry-${row.id}`,
        eventType: "booking_expiry",
        date: toDateOnly(row.booking_expiry_date),
        title: `Booking expiry: ${row.booking_code}`,
        subtitle: row.property_title || null,
        entityType: "booking",
        entityId: Number(row.id),
        status: row.status,
        path: `/bookings/${row.id}`,
      });
    }
  }

  // 7) Client follow-ups
  if (!typeFilter || typeFilter.has("client_follow_up")) {
    const params = [];
    const where = ["c.deleted_at IS NULL", "c.next_follow_up_date IS NOT NULL"];
    where.push(...dateWhere("c.next_follow_up_date", from, to, params));
    const result = await pool.query(
      `SELECT c.id, c.client_name, c.next_follow_up_date, c.phone
       FROM clients c
       WHERE ${where.join(" AND ")}
       ORDER BY c.next_follow_up_date ASC
       LIMIT 500`,
      params
    );
    for (const row of result.rows) {
      pushIf(events, typeFilter, {
        id: `client-follow-up-${row.id}`,
        eventType: "client_follow_up",
        date: toDateOnly(row.next_follow_up_date),
        title: `Follow-up: ${row.client_name}`,
        subtitle: row.phone || null,
        entityType: "client",
        entityId: Number(row.id),
        path: `/clients/${row.id}`,
      });
    }
  }

  // Related office dates (kept for completeness)
  if (!typeFilter || typeFilter.has("transfer")) {
    const params = [];
    const where = ["t.deleted_at IS NULL"];
    where.push(...dateWhere("t.transfer_date", from, to, params));
    const result = await pool.query(
      `SELECT t.id, t.transfer_type, t.transfer_date, p.title AS property_title
       FROM property_transfers t
       LEFT JOIN properties p ON p.id = t.property_id
       WHERE ${where.join(" AND ")}
       ORDER BY t.transfer_date ASC
       LIMIT 300`,
      params
    );
    for (const row of result.rows) {
      pushIf(events, typeFilter, {
        id: `transfer-${row.id}`,
        eventType: "transfer",
        date: toDateOnly(row.transfer_date),
        title: `${row.transfer_type}: transfer #${row.id}`,
        subtitle: row.property_title || null,
        entityType: "transfer",
        entityId: Number(row.id),
        path: `/transfers/${row.id}`,
      });
    }
  }

  if (!typeFilter || typeFilter.has("maintenance")) {
    const params = [];
    const where = ["m.deleted_at IS NULL"];
    where.push(...dateWhere("m.due_date", from, to, params));
    const result = await pool.query(
      `SELECT m.id, m.title, m.due_date, m.status, p.title AS property_title
       FROM maintenance_tasks m
       LEFT JOIN properties p ON p.id = m.property_id
       WHERE ${where.join(" AND ")}
       ORDER BY m.due_date ASC
       LIMIT 300`,
      params
    );
    for (const row of result.rows) {
      pushIf(events, typeFilter, {
        id: `maintenance-${row.id}`,
        eventType: "maintenance",
        date: toDateOnly(row.due_date),
        title: row.title,
        subtitle: row.property_title || null,
        entityType: "maintenance",
        entityId: Number(row.id),
        status: row.status,
        path: `/maintenance/${row.id}`,
      });
    }
  }

  if (!typeFilter || typeFilter.has("document_expiry")) {
    const params = [];
    const whereProp = ["d.deleted_at IS NULL", "d.expiry_date IS NOT NULL"];
    whereProp.push(...dateWhere("d.expiry_date", from, to, params));
    const propDocs = await pool.query(
      `SELECT d.id, d.document_name, d.document_type, d.expiry_date, d.property_id,
              p.title AS property_title
       FROM property_documents d
       JOIN properties p ON p.id = d.property_id AND p.deleted_at IS NULL
       WHERE ${whereProp.join(" AND ")}
         AND d.document_type NOT IN ('agreement', 'lease_certificate')
       ORDER BY d.expiry_date ASC
       LIMIT 200`,
      params
    );
    for (const row of propDocs.rows) {
      pushIf(events, typeFilter, {
        id: `property-doc-${row.id}`,
        eventType: "document_expiry",
        date: toDateOnly(row.expiry_date),
        title: row.document_name || row.document_type || "Property document",
        subtitle: row.property_title || null,
        entityType: "property_document",
        entityId: Number(row.id),
        path: `/properties/${row.property_id}`,
      });
    }
  }

  events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { from, to, items: events };
}

module.exports = { getCalendarEvents };
