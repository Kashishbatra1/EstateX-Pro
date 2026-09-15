/**
 * Payments Management service — approved schema only (payments + booking_installments + bookings).
 * No payment status column exists; soft-delete is the reversal mechanism.
 * Refund metadata lives on bookings (handled by Booking cancel flow).
 *
 * Financial model (compatible with Phase 7 booking_amount / remaining_balance):
 *   remaining_balance = total_price - booking_amount - SUM(active payment amounts)
 * Active payments further reduce the balance after the recorded down payment.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  toPublicPayment,
  PAYMENT_METADATA_FIELDS,
  toDateOnly,
} = require("../utils/paymentMapper");
const { toPublicInstallment } = require("../utils/bookingMapper");

const PAYMENT_SELECT = `
  SELECT pay.*,
         b.booking_code,
         b.status AS booking_status,
         b.property_id,
         b.client_id,
         b.remaining_balance,
         b.total_price,
         b.booking_amount,
         p.property_code,
         c.client_name,
         pm.method_name AS payment_method_name,
         ba.bank_name
  FROM payments pay
  JOIN bookings b ON b.id = pay.booking_id
  JOIN properties p ON p.id = b.property_id
  JOIN clients c ON c.id = b.client_id
  LEFT JOIN payment_methods pm ON pm.id = pay.payment_method_id
  LEFT JOIN bank_accounts ba ON ba.id = pay.bank_account_id
`;

const PAYABLE_BOOKING_STATUSES = ["pending", "confirmed"];

async function writeAudit(clientOrPool, adminId, action, entityId, oldData, newData) {
  await clientOrPool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, 'payment', $3, $4::jsonb, $5::jsonb)`,
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

async function generatePaymentCode(client) {
  const year = new Date().getFullYear();
  const result = await client.query(
    `SELECT COALESCE(
       MAX(NULLIF(regexp_replace(payment_code, '^PAY-' || $1 || '-', ''), payment_code)::INT),
       0
     ) + 1 AS next_num
     FROM payments
     WHERE payment_code ~ ('^PAY-' || $1 || '-[0-9]+$')`,
    [String(year)]
  );
  const next = Number(result.rows[0].next_num) || 1;
  return `PAY-${year}-${String(next).padStart(4, "0")}`;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function computeInstallmentStatus(amountPaid, amountDue, dueDate) {
  const paid = Number(amountPaid);
  const due = Number(amountDue);
  if (paid >= due && due >= 0) return "paid";
  if (paid > 0) return "partial";
  const dueStr = toDateOnly(dueDate);
  const today = new Date().toISOString().slice(0, 10);
  if (dueStr && dueStr < today) return "overdue";
  return "pending";
}

async function lockBooking(client, bookingId) {
  const result = await client.query(
    `SELECT b.*, p.property_code, c.client_name
     FROM bookings b
     JOIN properties p ON p.id = b.property_id
     JOIN clients c ON c.id = b.client_id
     WHERE b.id = $1
     FOR UPDATE OF b`,
    [bookingId]
  );
  return result.rows[0] || null;
}

async function sumActivePayments(client, bookingId, { excludePaymentId = null } = {}) {
  const result = await client.query(
    `SELECT COALESCE(SUM(amount), 0)::NUMERIC AS total
     FROM payments
     WHERE booking_id = $1
       AND deleted_at IS NULL
       AND ($2::bigint IS NULL OR id <> $2)`,
    [bookingId, excludePaymentId]
  );
  return Number(result.rows[0].total);
}

function expectedRemaining(booking, paymentsTotal) {
  return roundMoney(Number(booking.total_price) - Number(booking.booking_amount) - Number(paymentsTotal));
}

async function applyRemaining(client, bookingId, remaining) {
  if (remaining < -0.001) {
    throw new ApiError(400, "Payment would exceed remaining balance (overpayment not allowed)");
  }
  const safe = Math.max(0, roundMoney(remaining));
  await client.query(
    `UPDATE bookings
     SET remaining_balance = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [safe, bookingId]
  );
  return safe;
}

async function assertPaymentMethod(client, paymentMethodId) {
  const result = await client.query(
    `SELECT id, method_name, is_active FROM payment_methods WHERE id = $1 LIMIT 1`,
    [paymentMethodId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new ApiError(400, "Payment method not found", [
      { field: "paymentMethodId", message: "Valid payment method is required" },
    ]);
  }
  if (!row.is_active) {
    throw new ApiError(400, "Payment method is inactive", [
      { field: "paymentMethodId", message: "Select an active payment method" },
    ]);
  }
  return row;
}

async function assertBankAccount(client, bankAccountId) {
  if (!bankAccountId) return null;
  const result = await client.query(
    `SELECT id, bank_name, is_active, deleted_at
     FROM bank_accounts WHERE id = $1 LIMIT 1`,
    [bankAccountId]
  );
  const row = result.rows[0];
  if (!row || row.deleted_at) {
    throw new ApiError(400, "Bank account not found or deleted", [
      { field: "bankAccountId", message: "Valid bank account is required" },
    ]);
  }
  if (!row.is_active) {
    throw new ApiError(400, "Bank account is inactive", [
      { field: "bankAccountId", message: "Select an active bank account" },
    ]);
  }
  return row;
}

async function assertEmployee(client, employeeId) {
  if (!employeeId) return null;
  const result = await client.query(
    `SELECT id, deleted_at FROM employees WHERE id = $1 LIMIT 1`,
    [employeeId]
  );
  const row = result.rows[0];
  if (!row || row.deleted_at) {
    throw new ApiError(400, "Employee (receivedBy) not found", [
      { field: "receivedBy", message: "Valid employee id is required" },
    ]);
  }
  return row;
}

async function lockInstallment(client, installmentId, bookingId) {
  const result = await client.query(
    `SELECT * FROM booking_installments
     WHERE id = $1
     FOR UPDATE`,
    [installmentId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new ApiError(400, "Installment not found", [
      { field: "installmentId", message: "Valid installment is required" },
    ]);
  }
  if (Number(row.booking_id) !== Number(bookingId)) {
    throw new ApiError(400, "Installment does not belong to this booking", [
      { field: "installmentId", message: "Installment must belong to the booking" },
    ]);
  }
  return row;
}

async function applyInstallmentDelta(client, installment, deltaAmount) {
  const nextPaid = roundMoney(Number(installment.amount_paid) + Number(deltaAmount));
  const due = Number(installment.amount_due);
  if (nextPaid < -0.001) {
    throw new ApiError(400, "Installment paid amount cannot become negative");
  }
  if (nextPaid - due > 0.001) {
    throw new ApiError(400, "Payment would overpay this installment", {
      installmentId: Number(installment.id),
      amountDue: due,
      amountPaid: Number(installment.amount_paid),
      attemptedPaid: nextPaid,
    });
  }
  const safePaid = Math.max(0, Math.min(due, nextPaid));
  const status = computeInstallmentStatus(safePaid, due, installment.due_date);
  const result = await client.query(
    `UPDATE booking_installments
     SET amount_paid = $1, status = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [safePaid, status, installment.id]
  );
  return result.rows[0];
}

async function getPaymentRow(id, { includeDeleted = false, client = pool } = {}) {
  const result = await client.query(
    `${PAYMENT_SELECT}
     WHERE pay.id = $1
       AND ($2::boolean = TRUE OR pay.deleted_at IS NULL)
     LIMIT 1`,
    [id, includeDeleted]
  );
  return result.rows[0] || null;
}

async function createPayment(input, adminId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const booking = await lockBooking(client, input.bookingId);
    if (!booking || booking.deleted_at) {
      throw new ApiError(400, "Booking not found or deleted", [
        { field: "bookingId", message: "Valid existing booking is required" },
      ]);
    }
    if (!PAYABLE_BOOKING_STATUSES.includes(booking.status)) {
      throw new ApiError(
        400,
        `Payments are not allowed for ${booking.status} bookings`,
        [{ field: "bookingId", message: "Booking must be pending or confirmed" }]
      );
    }

    await assertPaymentMethod(client, input.paymentMethodId);
    await assertBankAccount(client, input.bankAccountId || null);
    await assertEmployee(client, input.receivedBy || null);

    const amount = roundMoney(input.amount);
    const paymentsTotal = await sumActivePayments(client, booking.id);
    const remainingBefore = expectedRemaining(booking, paymentsTotal);
    // Prefer live DB remaining if in sync; otherwise recompute from formula
    const liveRemaining = roundMoney(Number(booking.remaining_balance));
    const remaining = Math.min(liveRemaining, remainingBefore);
    if (amount - remaining > 0.001) {
      throw new ApiError(400, "Payment amount exceeds remaining balance", {
        remainingBalance: remaining,
        attemptedAmount: amount,
      });
    }

    let installment = null;
    if (input.installmentId) {
      installment = await lockInstallment(client, input.installmentId, booking.id);
      const room = roundMoney(Number(installment.amount_due) - Number(installment.amount_paid));
      if (amount - room > 0.001) {
        throw new ApiError(400, "Payment amount exceeds installment remaining", {
          installmentRemaining: room,
          attemptedAmount: amount,
        });
      }
    }

    const paymentCode = await generatePaymentCode(client);
    const paymentDate = input.paymentDate || new Date().toISOString().slice(0, 10);

    const insert = await client.query(
      `INSERT INTO payments (
         payment_code, booking_id, installment_id, amount, payment_date,
         payment_method_id, bank_account_id, reference_number, notes,
         received_by, created_by
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10, $11
       )
       RETURNING *`,
      [
        paymentCode,
        booking.id,
        input.installmentId || null,
        amount,
        paymentDate,
        input.paymentMethodId,
        input.bankAccountId || null,
        input.referenceNumber || null,
        input.notes || null,
        input.receivedBy || null,
        adminId || null,
      ]
    );

    const payment = insert.rows[0];
    const newPaymentsTotal = roundMoney(paymentsTotal + amount);
    const newRemaining = await applyRemaining(
      client,
      booking.id,
      expectedRemaining(booking, newPaymentsTotal)
    );

    let updatedInstallment = null;
    if (installment) {
      updatedInstallment = await applyInstallmentDelta(client, installment, amount);
    }

    await writeAudit(client, adminId, "PAYMENT_CREATE", payment.id, null, {
      paymentCode,
      bookingId: Number(booking.id),
      amount,
      remainingBalance: newRemaining,
      installmentId: input.installmentId || null,
    });

    await writePropertyHistory(
      client,
      booking.property_id,
      adminId,
      `Payment ${paymentCode} recorded for booking ${booking.booking_code}`,
      { remainingBalance: Number(booking.remaining_balance) },
      { remainingBalance: newRemaining, paymentId: Number(payment.id), amount }
    );

    await client.query("COMMIT");

    const full = await getPaymentRow(payment.id);
    return toPublicPayment(full, {
      remainingBalanceAfter: newRemaining,
      installment: updatedInstallment ? toPublicInstallment(updatedInstallment) : null,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof ApiError) throw err;
    if (err.code === "23505") {
      throw new ApiError(409, "Payment code conflict; please retry");
    }
    if (err.code === "23514") {
      throw new ApiError(400, err.message || "Payment failed database checks");
    }
    if (err.code === "23503") {
      throw new ApiError(400, "Related record not found for payment");
    }
    throw err;
  } finally {
    client.release();
  }
}

async function listPayments(query = {}) {
  const {
    search,
    bookingId,
    clientId,
    propertyId,
    paymentMethodId,
    bankAccountId,
    installmentId,
    paymentFrom,
    paymentTo,
    page = 1,
    limit = 20,
  } = query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const where = ["pay.deleted_at IS NULL"];
  const params = [];

  function add(sql, value) {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  }

  if (bookingId) add("pay.booking_id = ?", Number(bookingId));
  if (clientId) add("b.client_id = ?", Number(clientId));
  if (propertyId) add("b.property_id = ?", Number(propertyId));
  if (paymentMethodId) add("pay.payment_method_id = ?", Number(paymentMethodId));
  if (bankAccountId) add("pay.bank_account_id = ?", Number(bankAccountId));
  if (installmentId) add("pay.installment_id = ?", Number(installmentId));
  if (paymentFrom) add("pay.payment_date >= ?", paymentFrom);
  if (paymentTo) add("pay.payment_date <= ?", paymentTo);

  if (search && String(search).trim()) {
    const term = `%${String(search).trim()}%`;
    params.push(term, term, term, term);
    const i = params.length;
    where.push(
      `(pay.payment_code ILIKE $${i - 3}
        OR CAST(pay.id AS TEXT) ILIKE $${i - 2}
        OR COALESCE(pay.reference_number, '') ILIKE $${i - 1}
        OR COALESCE(b.booking_code, '') ILIKE $${i})`
    );
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM payments pay
     JOIN bookings b ON b.id = pay.booking_id
     ${whereSql}`,
    params
  );

  const listParams = [...params, limitNum, offset];
  const listResult = await pool.query(
    `${PAYMENT_SELECT}
     ${whereSql}
     ORDER BY pay.payment_date DESC, pay.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  return {
    items: listResult.rows.map((row) => toPublicPayment(row)),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limitNum) || 0,
    },
  };
}

async function getPaymentById(id) {
  const row = await getPaymentRow(id);
  if (!row) throw new ApiError(404, "Payment not found");

  let installment = null;
  if (row.installment_id) {
    const inst = await pool.query(
      `SELECT * FROM booking_installments WHERE id = $1`,
      [row.installment_id]
    );
    if (inst.rows[0]) installment = toPublicInstallment(inst.rows[0]);
  }

  return toPublicPayment(row, {
    remainingBalanceAfter: Number(row.remaining_balance),
    installment,
    booking: {
      id: Number(row.booking_id),
      bookingCode: row.booking_code,
      status: row.booking_status,
      totalPrice: Number(row.total_price),
      bookingAmount: Number(row.booking_amount),
      remainingBalance: Number(row.remaining_balance),
      propertyId: Number(row.property_id),
      clientId: Number(row.client_id),
    },
  });
}

async function updatePayment(id, input, adminId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT * FROM payments WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [id]
    );
    if (!existing.rows[0]) throw new ApiError(404, "Payment not found");
    const payment = existing.rows[0];

    const booking = await lockBooking(client, payment.booking_id);
    if (!booking || booking.deleted_at) {
      throw new ApiError(400, "Related booking is missing or deleted");
    }
    if (!PAYABLE_BOOKING_STATUSES.includes(booking.status)) {
      throw new ApiError(400, `Cannot update payments on ${booking.status} bookings`);
    }

    const sets = [];
    const values = [];
    const touched = {};

    function setCol(dbCol, value) {
      values.push(value === "" ? null : value);
      sets.push(`${dbCol} = $${values.length}`);
    }

    const nextAmount =
      input.amount !== undefined ? roundMoney(input.amount) : Number(payment.amount);
    const amountChanged = input.amount !== undefined && nextAmount !== Number(payment.amount);

    if (input.amount !== undefined) {
      if (nextAmount <= 0) throw new ApiError(400, "Payment amount must be positive");
      setCol("amount", nextAmount);
      touched.amount = nextAmount;
    }

    for (const [apiKey, dbCol] of Object.entries(PAYMENT_METADATA_FIELDS)) {
      if (!Object.prototype.hasOwnProperty.call(input, apiKey)) continue;
      if (apiKey === "paymentMethodId") {
        await assertPaymentMethod(client, Number(input.paymentMethodId));
        setCol(dbCol, Number(input.paymentMethodId));
        touched[apiKey] = Number(input.paymentMethodId);
        continue;
      }
      if (apiKey === "bankAccountId") {
        const bankId =
          input.bankAccountId === null || input.bankAccountId === ""
            ? null
            : Number(input.bankAccountId);
        if (bankId) await assertBankAccount(client, bankId);
        setCol(dbCol, bankId);
        touched[apiKey] = bankId;
        continue;
      }
      if (apiKey === "receivedBy") {
        const empId =
          input.receivedBy === null || input.receivedBy === ""
            ? null
            : Number(input.receivedBy);
        if (empId) await assertEmployee(client, empId);
        setCol(dbCol, empId);
        touched[apiKey] = empId;
        continue;
      }
      setCol(dbCol, input[apiKey]);
      touched[apiKey] = input[apiKey] === "" ? null : input[apiKey];
    }

    if (!sets.length) throw new ApiError(400, "No updatable fields provided");

    let updatedInstallment = null;
    if (amountChanged) {
      const delta = roundMoney(nextAmount - Number(payment.amount));
      const othersTotal = await sumActivePayments(client, booking.id, {
        excludePaymentId: id,
      });
      const projectedRemaining = expectedRemaining(booking, othersTotal + nextAmount);
      if (projectedRemaining < -0.001) {
        throw new ApiError(400, "Updated amount would exceed remaining balance");
      }

      if (payment.installment_id) {
        const installment = await lockInstallment(client, payment.installment_id, booking.id);
        updatedInstallment = await applyInstallmentDelta(client, installment, delta);
      }

      await applyRemaining(client, booking.id, projectedRemaining);
      touched.remainingBalance = projectedRemaining;
    }

    values.push(id);
    const result = await client.query(
      `UPDATE payments
       SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    if (!result.rows[0]) throw new ApiError(404, "Payment not found");

    await writeAudit(
      client,
      adminId,
      "PAYMENT_UPDATE",
      id,
      {
        amount: Number(payment.amount),
        paymentDate: payment.payment_date,
        referenceNumber: payment.reference_number,
      },
      touched
    );

    await client.query("COMMIT");

    const full = await getPaymentById(id);
    if (updatedInstallment) {
      full.installment = toPublicInstallment(updatedInstallment);
    }
    return full;
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof ApiError) throw err;
    if (err.code === "23514") {
      throw new ApiError(400, err.message || "Payment update failed database checks");
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Soft-delete payment = financial reversal (no separate refund payment type in schema).
 * Booking.refund_* fields remain on the booking cancel flow.
 */
async function reversePayment(id, adminId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT * FROM payments WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [id]
    );
    if (!existing.rows[0]) throw new ApiError(404, "Payment not found");
    const payment = existing.rows[0];

    const booking = await lockBooking(client, payment.booking_id);
    if (!booking) throw new ApiError(400, "Related booking not found");

    if (payment.installment_id) {
      const installment = await lockInstallment(client, payment.installment_id, booking.id);
      await applyInstallmentDelta(client, installment, -Number(payment.amount));
    }

    const othersTotal = await sumActivePayments(client, booking.id, {
      excludePaymentId: id,
    });
    const newRemaining = await applyRemaining(
      client,
      booking.id,
      expectedRemaining(booking, othersTotal)
    );

    const result = await client.query(
      `UPDATE payments
       SET deleted_at = CURRENT_TIMESTAMP,
           deleted_by = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [adminId, id]
    );

    await writeAudit(
      client,
      adminId,
      "PAYMENT_REVERSE",
      id,
      { amount: Number(payment.amount), deletedAt: null },
      { deletedAt: result.rows[0].deleted_at, remainingBalance: newRemaining }
    );

    await writePropertyHistory(
      client,
      booking.property_id,
      adminId,
      `Payment ${payment.payment_code || payment.id} reversed for booking ${booking.booking_code}`,
      { remainingBalance: Number(booking.remaining_balance) },
      { remainingBalance: newRemaining, paymentId: Number(id), reversedAmount: Number(payment.amount) }
    );

    await client.query("COMMIT");

    const full = await getPaymentRow(id, { includeDeleted: true });
    return toPublicPayment(full, { remainingBalanceAfter: newRemaining });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof ApiError) throw err;
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createPayment,
  listPayments,
  getPaymentById,
  updatePayment,
  reversePayment,
};
