/**
 * Booking Management service — approved schema only (bookings + booking_installments).
 * Does not implement Payments / Commission modules.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  ALLOWED_TRANSITIONS,
  ACTIVE_BOOKING_STATUSES,
  BOOKING_WRITABLE_FIELDS,
  toPublicBooking,
  toPublicInstallment,
} = require("../utils/bookingMapper");
const { notifyEvent } = require("./notification.service");

const BOOKING_SELECT = `
  SELECT b.*,
         p.property_code,
         p.title AS property_title,
         p.status AS property_status,
         c.client_name
  FROM bookings b
  JOIN properties p ON p.id = b.property_id
  JOIN clients c ON c.id = b.client_id
`;

async function writeAudit(clientOrPool, adminId, action, entityId, oldData, newData) {
  await clientOrPool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, 'booking', $3, $4::jsonb, $5::jsonb)`,
    [
      adminId || null,
      action,
      entityId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
    ]
  );
}

async function writePropertyHistory(clientOrPool, propertyId, adminId, description, oldValue, newValue) {
  await clientOrPool.query(
    `INSERT INTO property_history
       (property_id, event_type, old_value, new_value, description, performed_by)
     VALUES ($1, 'other', $2::jsonb, $3::jsonb, $4, $5)`,
    [
      propertyId,
      JSON.stringify(oldValue || {}),
      JSON.stringify(newValue || {}),
      description,
      adminId || null,
    ]
  );
}

async function generateBookingCode(client) {
  const year = new Date().getFullYear();
  const prefix = `BK-${year}-`;
  const result = await client.query(
    `SELECT COALESCE(
       MAX(NULLIF(regexp_replace(booking_code, '^BK-' || $1 || '-', ''), booking_code)::INT),
       0
     ) + 1 AS next_num
     FROM bookings
     WHERE booking_code ~ ('^BK-' || $1 || '-[0-9]+$')`,
    [String(year)]
  );
  const next = Number(result.rows[0].next_num) || 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

async function getBookingRow(id, { includeDeleted = false, client = pool } = {}) {
  const result = await client.query(
    `${BOOKING_SELECT}
     WHERE b.id = $1
       AND ($2::boolean = TRUE OR b.deleted_at IS NULL)
     LIMIT 1`,
    [id, includeDeleted]
  );
  return result.rows[0] || null;
}

async function listInstallments(bookingId, client = pool) {
  const result = await client.query(
    `SELECT * FROM booking_installments
     WHERE booking_id = $1
     ORDER BY installment_number ASC, id ASC`,
    [bookingId]
  );
  return result.rows.map(toPublicInstallment);
}

async function assertValidProperty(propertyId, client = pool) {
  const result = await client.query(
    `SELECT id, status, purpose, asking_price, deleted_at
     FROM properties
     WHERE id = $1
     LIMIT 1`,
    [propertyId]
  );
  const property = result.rows[0];
  if (!property || property.deleted_at) {
    throw new ApiError(400, "Property not found or is deleted", [
      { field: "propertyId", message: "Valid existing property is required" },
    ]);
  }
  if (property.status === "draft") {
    throw new ApiError(400, "Draft properties are not eligible for booking", [
      { field: "propertyId", message: "Property must leave draft before booking" },
    ]);
  }
  if (property.status === "sold" || property.status === "rented") {
    throw new ApiError(400, `Property is already ${property.status} and cannot be booked`, [
      { field: "propertyId", message: "Property is not available for booking" },
    ]);
  }
  return property;
}

async function assertValidClient(clientId, client = pool) {
  const result = await client.query(
    `SELECT id, deleted_at FROM clients WHERE id = $1 LIMIT 1`,
    [clientId]
  );
  const row = result.rows[0];
  if (!row || row.deleted_at) {
    throw new ApiError(400, "Client not found or is deleted", [
      { field: "clientId", message: "Valid existing client is required" },
    ]);
  }
  return row;
}

async function assertNoActiveConflict(propertyId, { excludeBookingId = null, client = pool } = {}) {
  const result = await client.query(
    `SELECT id, booking_code, status
     FROM bookings
     WHERE property_id = $1
       AND deleted_at IS NULL
       AND status = ANY($2::booking_status_enum[])
       AND ($3::bigint IS NULL OR id <> $3)
     LIMIT 1`,
    [propertyId, ACTIVE_BOOKING_STATUSES, excludeBookingId]
  );
  if (result.rows[0]) {
    throw new ApiError(
      409,
      "Property already has an active booking",
      {
        conflictingBookingId: Number(result.rows[0].id),
        conflictingBookingCode: result.rows[0].booking_code,
        conflictingStatus: result.rows[0].status,
      }
    );
  }
}

function calcRemaining(totalPrice, bookingAmount) {
  const remaining = Number(totalPrice) - Number(bookingAmount);
  if (remaining < 0) {
    throw new ApiError(400, "Down payment cannot exceed total price");
  }
  return remaining;
}

async function insertInstallments(client, bookingId, installments) {
  if (!Array.isArray(installments) || !installments.length) return [];
  const created = [];
  for (let i = 0; i < installments.length; i += 1) {
    const item = installments[i];
    const number = item.installmentNumber || i + 1;
    const result = await client.query(
      `INSERT INTO booking_installments
         (booking_id, installment_number, due_date, amount_due, amount_paid, status, notes)
       VALUES ($1, $2, $3, $4, 0, 'pending', $5)
       RETURNING *`,
      [
        bookingId,
        number,
        item.dueDate,
        Number(item.amountDue),
        item.notes || null,
      ]
    );
    created.push(toPublicInstallment(result.rows[0]));
  }
  return created;
}

async function syncPropertyStatusForBooking(client, property, bookingStatus, adminId) {
  const propertyId = property.id;
  let nextStatus = null;

  if (bookingStatus === "confirmed" && property.status === "available") {
    nextStatus = "reserved";
  } else if (bookingStatus === "cancelled" && property.status === "reserved") {
    // Restore only if no other active bookings remain
    const other = await client.query(
      `SELECT 1 FROM bookings
       WHERE property_id = $1
         AND deleted_at IS NULL
         AND status = ANY($2::booking_status_enum[])
       LIMIT 1`,
      [propertyId, ACTIVE_BOOKING_STATUSES]
    );
    if (!other.rows[0]) nextStatus = "available";
  } else if (bookingStatus === "completed") {
    nextStatus = property.purpose === "rent" ? "rented" : "sold";
  }

  if (!nextStatus || nextStatus === property.status) return null;

  const updated = await client.query(
    `UPDATE properties
     SET status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [nextStatus, propertyId]
  );

  await client.query(
    `INSERT INTO property_history
       (property_id, event_type, old_value, new_value, description, performed_by)
     VALUES ($1, 'status_change', $2::jsonb, $3::jsonb, $4, $5)`,
    [
      propertyId,
      JSON.stringify({ status: property.status, via: "booking" }),
      JSON.stringify({ status: nextStatus, via: "booking" }),
      `Property status set to ${nextStatus} due to booking ${bookingStatus}`,
      adminId || null,
    ]
  );

  return updated.rows[0] || null;
}

async function createBooking(input, adminId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const property = await assertValidProperty(input.propertyId, client);
    if (property.status !== "available" && property.status !== "reserved") {
      throw new ApiError(400, "Property is not eligible for booking", [
        { field: "propertyId", message: `Property status must be available (current: ${property.status})` },
      ]);
    }
    // New bookings require an available property (reserved means another active hold)
    if (property.status === "reserved") {
      throw new ApiError(400, "Property is reserved by another booking", [
        { field: "propertyId", message: "Property is not available for a new booking" },
      ]);
    }

    await assertValidClient(input.clientId, client);
    await assertNoActiveConflict(input.propertyId, { client });

    const remaining = calcRemaining(input.totalPrice, input.bookingAmount);
    const bookingCode = await generateBookingCode(client);

    const result = await client.query(
      `INSERT INTO bookings (
         booking_code, property_id, client_id,
         booking_amount, total_price, remaining_balance,
         installment_plan_name, monthly_installment_amount,
         token_receipt_number, booking_expiry_date, digital_agreement_url,
         status, created_by
       ) VALUES (
         $1, $2, $3,
         $4, $5, $6,
         $7, $8,
         $9, $10, $11,
         'pending', $12
       )
       RETURNING *`,
      [
        bookingCode,
        input.propertyId,
        input.clientId,
        input.bookingAmount,
        input.totalPrice,
        remaining,
        input.installmentPlanName || null,
        input.monthlyInstallmentAmount !== undefined ? input.monthlyInstallmentAmount : null,
        input.tokenReceiptNumber || null,
        input.bookingExpiryDate || null,
        input.digitalAgreementUrl || null,
        adminId || null,
      ]
    );

    const row = result.rows[0];
    const installments = await insertInstallments(client, row.id, input.installments);

    await writePropertyHistory(
      client,
      input.propertyId,
      adminId,
      `Booking ${bookingCode} created (pending)`,
      {},
      { bookingId: Number(row.id), bookingCode, status: "pending" }
    );

    await writeAudit(client, adminId, "BOOKING_CREATE", row.id, null, {
      bookingCode,
      propertyId: input.propertyId,
      clientId: input.clientId,
      bookingAmount: input.bookingAmount,
      totalPrice: input.totalPrice,
      remainingBalance: remaining,
      status: "pending",
    });

    await client.query("COMMIT");

    await notifyEvent({
      adminId: adminId || null,
      notificationType: "general",
      title: "Booking created",
      message: `Booking ${bookingCode} was created (pending)`,
      entityType: "booking",
      entityId: Number(row.id),
      dedupeDays: 1,
    });

    const full = await getBookingRow(row.id);
    return toPublicBooking(full, { installments });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof ApiError) throw err;
    if (err.code === "23505") {
      throw new ApiError(409, "Booking code conflict; please retry");
    }
    if (err.code === "23514") {
      throw new ApiError(400, err.message || "Booking data failed database checks");
    }
    throw err;
  } finally {
    client.release();
  }
}

async function listBookings(query = {}) {
  const {
    search,
    status,
    propertyId,
    clientId,
    bookedFrom,
    bookedTo,
    expiryFrom,
    expiryTo,
    page = 1,
    limit = 20,
  } = query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const where = ["b.deleted_at IS NULL"];
  const params = [];

  function add(sql, value) {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  }

  if (status) add("b.status = ?", String(status).toLowerCase());
  if (propertyId) add("b.property_id = ?", Number(propertyId));
  if (clientId) add("b.client_id = ?", Number(clientId));
  if (bookedFrom) add("b.booked_at::date >= ?", bookedFrom);
  if (bookedTo) add("b.booked_at::date <= ?", bookedTo);
  if (expiryFrom) add("b.booking_expiry_date >= ?", expiryFrom);
  if (expiryTo) add("b.booking_expiry_date <= ?", expiryTo);

  if (search && String(search).trim()) {
    const term = `%${String(search).trim()}%`;
    params.push(term, term, term);
    const i = params.length;
    where.push(
      `(b.booking_code ILIKE $${i - 2}
        OR CAST(b.id AS TEXT) ILIKE $${i - 1}
        OR COALESCE(b.token_receipt_number, '') ILIKE $${i})`
    );
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total FROM bookings b ${whereSql}`,
    params
  );

  const listParams = [...params, limitNum, offset];
  const listResult = await pool.query(
    `${BOOKING_SELECT}
     ${whereSql}
     ORDER BY b.booked_at DESC, b.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  return {
    items: listResult.rows.map((row) => toPublicBooking(row)),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limitNum) || 0,
    },
  };
}

async function getBookingById(id) {
  const row = await getBookingRow(id);
  if (!row) throw new ApiError(404, "Booking not found");
  const installments = await listInstallments(id);
  return toPublicBooking(row, { installments });
}

async function updateBooking(id, input, adminId) {
  const existing = await getBookingRow(id);
  if (!existing) throw new ApiError(404, "Booking not found");

  if (existing.status === "cancelled" || existing.status === "completed") {
    throw new ApiError(400, `Cannot update a ${existing.status} booking`);
  }

  const sets = [];
  const values = [];
  const touched = {};

  function setCol(dbCol, value) {
    values.push(value === "" ? null : value);
    sets.push(`${dbCol} = $${values.length}`);
  }

  // Money fields — recalculate remaining balance
  const nextAmount =
    input.bookingAmount !== undefined ? Number(input.bookingAmount) : Number(existing.booking_amount);
  const nextTotal =
    input.totalPrice !== undefined ? Number(input.totalPrice) : Number(existing.total_price);

  if (input.bookingAmount !== undefined || input.totalPrice !== undefined) {
    if (Number.isNaN(nextAmount) || nextAmount < 0) {
      throw new ApiError(400, "Down payment must be a non-negative number");
    }
    if (Number.isNaN(nextTotal) || nextTotal < 0) {
      throw new ApiError(400, "Total price must be a non-negative number");
    }
    if (nextAmount > nextTotal) {
      throw new ApiError(400, "Down payment cannot exceed total price");
    }
    setCol("booking_amount", nextAmount);
    setCol("total_price", nextTotal);
    setCol("remaining_balance", calcRemaining(nextTotal, nextAmount));
    touched.bookingAmount = nextAmount;
    touched.totalPrice = nextTotal;
    touched.remainingBalance = calcRemaining(nextTotal, nextAmount);
  }

  for (const [apiKey, dbCol] of Object.entries(BOOKING_WRITABLE_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(input, apiKey)) continue;
    // Cancellation/refund fields only meaningful when cancelling via status endpoint,
    // but schema allows storing them; allow update for pending/confirmed maintenance.
    if (apiKey === "monthlyInstallmentAmount") {
      const monthly =
        input.monthlyInstallmentAmount === null || input.monthlyInstallmentAmount === ""
          ? null
          : Number(input.monthlyInstallmentAmount);
      if (monthly !== null && (Number.isNaN(monthly) || monthly < 0)) {
        throw new ApiError(400, "Monthly installment must be non-negative");
      }
      setCol(dbCol, monthly);
      touched[apiKey] = monthly;
      continue;
    }
    if (apiKey === "refundAmount") {
      const refund =
        input.refundAmount === null || input.refundAmount === ""
          ? null
          : Number(input.refundAmount);
      if (refund !== null && (Number.isNaN(refund) || refund < 0)) {
        throw new ApiError(400, "Refund amount must be non-negative");
      }
      setCol(dbCol, refund);
      touched[apiKey] = refund;
      continue;
    }
    setCol(dbCol, input[apiKey]);
    touched[apiKey] = input[apiKey] === "" ? null : input[apiKey];
  }

  if (!sets.length) throw new ApiError(400, "No updatable fields provided");

  values.push(id);
  const result = await pool.query(
    `UPDATE bookings
     SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${values.length} AND deleted_at IS NULL
     RETURNING *`,
    values
  );

  if (!result.rows[0]) throw new ApiError(404, "Booking not found");

  await writeAudit(pool, adminId, "BOOKING_UPDATE", id, {
    bookingAmount: Number(existing.booking_amount),
    totalPrice: Number(existing.total_price),
    remainingBalance: Number(existing.remaining_balance),
    bookingExpiryDate: existing.booking_expiry_date,
  }, touched);

  await writePropertyHistory(
    pool,
    existing.property_id,
    adminId,
    `Booking ${existing.booking_code} details updated`,
    {},
    touched
  );

  return getBookingById(id);
}

async function changeBookingStatus(id, input, adminId) {
  const newStatus = String(input.status).toLowerCase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await getBookingRow(id, { client });
    if (!existing) throw new ApiError(404, "Booking not found");

    if (existing.status === newStatus) {
      await client.query("COMMIT");
      return getBookingById(id);
    }

    const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new ApiError(
        400,
        `Invalid status transition from ${existing.status} to ${newStatus}`,
        { allowedTransitions: allowed }
      );
    }

    if (newStatus === "cancelled" && !(input.cancellationReason || "").trim()) {
      throw new ApiError(400, "Cancellation reason is required");
    }

    // Confirming requires no other active booking and property still bookable
    if (newStatus === "confirmed") {
      await assertNoActiveConflict(existing.property_id, {
        excludeBookingId: id,
        client,
      });
    }

    const sets = ["status = $1", "updated_at = CURRENT_TIMESTAMP"];
    const values = [newStatus];

    if (newStatus === "confirmed") {
      values.push(new Date().toISOString());
      sets.push(`confirmed_at = $${values.length}`);
    }
    if (newStatus === "cancelled") {
      values.push(new Date().toISOString());
      sets.push(`cancelled_at = $${values.length}`);
      values.push(input.cancellationReason.trim());
      sets.push(`cancellation_reason = $${values.length}`);
      if (input.refundAmount !== undefined && input.refundAmount !== null && input.refundAmount !== "") {
        values.push(Number(input.refundAmount));
        sets.push(`refund_amount = $${values.length}`);
      }
      if (input.refundDetails !== undefined) {
        values.push(input.refundDetails === "" ? null : input.refundDetails);
        sets.push(`refund_details = $${values.length}`);
      }
    }
    if (newStatus === "completed") {
      values.push(new Date().toISOString());
      sets.push(`completed_at = $${values.length}`);
    }

    values.push(id);
    const result = await client.query(
      `UPDATE bookings
       SET ${sets.join(", ")}
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (!result.rows[0]) throw new ApiError(404, "Booking not found");

    const propertyResult = await client.query(
      `SELECT id, status, purpose FROM properties WHERE id = $1 AND deleted_at IS NULL`,
      [existing.property_id]
    );
    const property = propertyResult.rows[0];
    if (property) {
      await syncPropertyStatusForBooking(client, property, newStatus, adminId);
    }

    await writePropertyHistory(
      client,
      existing.property_id,
      adminId,
      `Booking ${existing.booking_code} status ${existing.status} → ${newStatus}`,
      { status: existing.status },
      { status: newStatus, bookingId: id }
    );

    await writeAudit(
      client,
      adminId,
      `BOOKING_${newStatus.toUpperCase()}`,
      id,
      { status: existing.status },
      {
        status: newStatus,
        cancellationReason: input.cancellationReason || null,
        refundAmount: input.refundAmount ?? null,
      }
    );

    await client.query("COMMIT");

    const statusTitles = {
      confirmed: "Booking confirmed",
      cancelled: "Booking cancelled",
      completed: "Booking completed",
    };
    if (statusTitles[newStatus]) {
      await notifyEvent({
        adminId: adminId || existing.created_by || null,
        notificationType: "general",
        title: statusTitles[newStatus],
        message: `Booking ${existing.booking_code} is now ${newStatus}`,
        entityType: "booking",
        entityId: Number(id),
        dedupeDays: 1,
      });
    }

    return getBookingById(id);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof ApiError) throw err;
    if (err.code === "23514" || err.code === "P0001") {
      throw new ApiError(400, err.message || "Status change rejected by database rules");
    }
    throw err;
  } finally {
    client.release();
  }
}

async function cancelBooking(id, input, adminId) {
  return changeBookingStatus(
    id,
    {
      status: "cancelled",
      cancellationReason: input.cancellationReason,
      refundAmount: input.refundAmount,
      refundDetails: input.refundDetails,
    },
    adminId
  );
}

async function completeBooking(id, adminId) {
  return changeBookingStatus(id, { status: "completed" }, adminId);
}

async function softDeleteBooking(id, adminId) {
  const existing = await getBookingRow(id);
  if (!existing) throw new ApiError(404, "Booking not found");

  // Safe archive: only terminal bookings (or pending with no confirmed hold)
  if (existing.status === "confirmed") {
    throw new ApiError(
      400,
      "Confirmed bookings cannot be archived; cancel or complete them first"
    );
  }

  const result = await pool.query(
    `UPDATE bookings
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [adminId, id]
  );

  if (!result.rows[0]) throw new ApiError(404, "Booking not found");

  await writeAudit(pool, adminId, "BOOKING_SOFT_DELETE", id, { deletedAt: null }, {
    deletedAt: result.rows[0].deleted_at,
  });

  await writePropertyHistory(
    pool,
    existing.property_id,
    adminId,
    `Booking ${existing.booking_code} moved to recycle bin`,
    { deletedAt: null },
    { deletedAt: result.rows[0].deleted_at }
  );

  return toPublicBooking(await getBookingRow(id, { includeDeleted: true }));
}

module.exports = {
  createBooking,
  listBookings,
  getBookingById,
  updateBooking,
  changeBookingStatus,
  cancelBooking,
  completeBooking,
  softDeleteBooking,
};
