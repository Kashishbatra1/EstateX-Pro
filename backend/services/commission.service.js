/**
 * Commission & Brokerage service — approved `commissions` table only.
 *
 * Financial model:
 *   baseAmount = booking.total_price when booking linked,
 *                else property.asking_price (sale/booking) or monthly_rent (rent)
 *   calculatedAmount = round(baseAmount * commissionPercentage / 100)
 *   finalAmount = override amount when is_manual_override, else calculatedAmount
 *
 * Property-history override logging is handled by DB trigger
 * `trg_commissions_override_history`.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  toPublicCommission,
  roundMoney,
  PAYMENT_STATUSES,
} = require("../utils/commissionMapper");

const COMMISSION_SELECT = `
  SELECT c.*,
         p.property_code,
         p.title AS property_title,
         p.status AS property_status,
         p.purpose AS property_purpose,
         p.asking_price,
         p.monthly_rent,
         b.booking_code,
         b.status AS booking_status,
         b.total_price AS booking_total_price,
         b.client_id,
         cl.client_name,
         e.full_name AS assigned_agent_name,
         CASE
           WHEN b.id IS NOT NULL THEN b.total_price
           WHEN p.purpose = 'rent' THEN p.monthly_rent
           ELSE p.asking_price
         END AS base_amount
  FROM commissions c
  JOIN properties p ON p.id = c.property_id
  LEFT JOIN bookings b ON b.id = c.booking_id AND b.deleted_at IS NULL
  LEFT JOIN clients cl ON cl.id = b.client_id
  LEFT JOIN employees e ON e.id = c.assigned_agent_id
`;

async function writeAudit(clientOrPool, adminId, action, entityId, oldData, newData) {
  await clientOrPool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, 'commission', $3, $4::jsonb, $5::jsonb)`,
    [
      adminId || null,
      action,
      entityId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
    ]
  );
}

async function getCommissionRow(id, { includeDeleted = false, client = pool } = {}) {
  const where = includeDeleted
    ? "c.id = $1"
    : "c.id = $1 AND c.deleted_at IS NULL";
  const result = await client.query(
    `${COMMISSION_SELECT} WHERE ${where} LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function assertProperty(client, propertyId) {
  const result = await client.query(
    `SELECT id, purpose, asking_price, monthly_rent, status, deleted_at
     FROM properties WHERE id = $1 LIMIT 1`,
    [propertyId]
  );
  const row = result.rows[0];
  if (!row || row.deleted_at) {
    throw new ApiError(400, "Property not found", [
      { field: "propertyId", message: "Valid active property is required" },
    ]);
  }
  return row;
}

async function assertBooking(client, bookingId, propertyId) {
  if (!bookingId) return null;
  const result = await client.query(
    `SELECT id, property_id, total_price, status, deleted_at
     FROM bookings WHERE id = $1 LIMIT 1`,
    [bookingId]
  );
  const row = result.rows[0];
  if (!row || row.deleted_at) {
    throw new ApiError(400, "Booking not found", [
      { field: "bookingId", message: "Valid active booking is required" },
    ]);
  }
  if (Number(row.property_id) !== Number(propertyId)) {
    throw new ApiError(400, "Booking does not belong to property", [
      {
        field: "bookingId",
        message: "Booking must be for the selected property",
      },
    ]);
  }
  return row;
}

async function assertEmployee(client, employeeId) {
  if (!employeeId) return null;
  const result = await client.query(
    `SELECT id, is_active, deleted_at FROM employees WHERE id = $1 LIMIT 1`,
    [employeeId]
  );
  const row = result.rows[0];
  if (!row || row.deleted_at || row.is_active === false) {
    throw new ApiError(400, "Assigned agent not found", [
      { field: "assignedAgentId", message: "Valid active employee is required" },
    ]);
  }
  return row;
}

function resolveBaseAmount(property, booking) {
  if (booking) {
    return roundMoney(booking.total_price);
  }
  if (property.purpose === "rent") {
    if (property.monthly_rent === null || property.monthly_rent === undefined) {
      throw new ApiError(400, "Cannot calculate commission without a rent amount", [
        {
          field: "commissionPercentage",
          message: "Property monthly rent is required when no booking is linked",
        },
      ]);
    }
    return roundMoney(property.monthly_rent);
  }
  if (property.asking_price === null || property.asking_price === undefined) {
    throw new ApiError(400, "Cannot calculate commission without a base amount", [
      {
        field: "commissionPercentage",
        message: "Property asking price is required when no booking is linked",
      },
    ]);
  }
  return roundMoney(property.asking_price);
}

function computeAmounts({
  baseAmount,
  commissionPercentage,
  isManualOverride,
  finalAmount,
}) {
  let calculatedAmount = null;
  if (
    commissionPercentage !== null &&
    commissionPercentage !== undefined &&
    !Number.isNaN(Number(commissionPercentage))
  ) {
    calculatedAmount = roundMoney(
      (Number(baseAmount) * Number(commissionPercentage)) / 100
    );
  }

  if (isManualOverride) {
    if (finalAmount === null || finalAmount === undefined) {
      throw new ApiError(400, "Manual override requires finalAmount", [
        { field: "finalAmount", message: "finalAmount is required" },
      ]);
    }
    return {
      calculatedAmount,
      finalAmount: roundMoney(finalAmount),
    };
  }

  return {
    calculatedAmount,
    finalAmount: calculatedAmount,
  };
}

async function createCommission(input, adminId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const property = await assertProperty(client, input.propertyId);
    const booking = await assertBooking(
      client,
      input.bookingId || null,
      input.propertyId
    );
    await assertEmployee(client, input.assignedAgentId || null);

    const baseAmount = resolveBaseAmount(property, booking);
    const { calculatedAmount, finalAmount } = computeAmounts({
      baseAmount,
      commissionPercentage: input.commissionPercentage,
      isManualOverride: Boolean(input.isManualOverride),
      finalAmount: input.finalAmount,
    });

    if (input.isManualOverride && !input.overrideReason) {
      throw new ApiError(400, "Override reason required", [
        { field: "overrideReason", message: "overrideReason is required" },
      ]);
    }

    const inserted = await client.query(
      `INSERT INTO commissions (
         property_id, booking_id, commission_percentage,
         calculated_amount, final_amount, is_manual_override, override_reason,
         brokerage_from_buyer, brokerage_from_seller, payment_status,
         assigned_agent_id, referral_source, created_by
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
       )
       RETURNING id`,
      [
        input.propertyId,
        input.bookingId || null,
        input.commissionPercentage,
        calculatedAmount,
        finalAmount,
        Boolean(input.isManualOverride),
        input.isManualOverride ? input.overrideReason : null,
        input.brokerageFromBuyer ?? 0,
        input.brokerageFromSeller ?? 0,
        input.paymentStatus || "unpaid",
        input.assignedAgentId || null,
        input.referralSource || null,
        adminId || null,
      ]
    );

    const id = inserted.rows[0].id;
    const row = await getCommissionRow(id, { client });
    await writeAudit(client, adminId, "COMMISSION_CREATE", id, null, {
      id,
      propertyId: input.propertyId,
      bookingId: input.bookingId || null,
      calculatedAmount,
      finalAmount,
      isManualOverride: Boolean(input.isManualOverride),
    });

    await client.query("COMMIT");
    return toPublicCommission(row);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listCommissions(query = {}) {
  const {
    search,
    propertyId,
    bookingId,
    paymentStatus,
    isManualOverride,
    page = 1,
    limit = 20,
  } = query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const params = [];
  const where = ["c.deleted_at IS NULL"];

  function add(clause, value) {
    params.push(value);
    where.push(clause.replace("?", `$${params.length}`));
  }

  if (propertyId) add("c.property_id = ?", Number(propertyId));
  if (bookingId) add("c.booking_id = ?", Number(bookingId));
  if (paymentStatus) {
    const status = String(paymentStatus).toLowerCase();
    if (PAYMENT_STATUSES.includes(status)) add("c.payment_status = ?", status);
  }
  if (isManualOverride === true || isManualOverride === "true") {
    where.push("c.is_manual_override = TRUE");
  } else if (isManualOverride === false || isManualOverride === "false") {
    where.push("c.is_manual_override = FALSE");
  }
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    params.push(q);
    const i = params.length;
    where.push(
      `(p.property_code ILIKE $${i} OR p.title ILIKE $${i} OR b.booking_code ILIKE $${i} OR c.referral_source ILIKE $${i} OR cl.client_name ILIKE $${i})`
    );
  }

  const whereSql = where.join(" AND ");
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM commissions c
     JOIN properties p ON p.id = c.property_id
     LEFT JOIN bookings b ON b.id = c.booking_id AND b.deleted_at IS NULL
     LEFT JOIN clients cl ON cl.id = b.client_id
     WHERE ${whereSql}`,
    params
  );
  const total = countResult.rows[0].total;

  const listParams = [...params, limitNum, offset];
  const listResult = await pool.query(
    `${COMMISSION_SELECT}
     WHERE ${whereSql}
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    listParams
  );

  return {
    items: listResult.rows.map(toPublicCommission),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    },
  };
}

async function getCommissionById(id) {
  const row = await getCommissionRow(id);
  if (!row) {
    throw new ApiError(404, "Commission not found");
  }
  return toPublicCommission(row);
}

async function updateCommission(id, input, adminId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await getCommissionRow(id, { client });
    if (!existing) {
      throw new ApiError(404, "Commission not found");
    }

    const property = await assertProperty(client, existing.property_id);
    const booking = await assertBooking(
      client,
      existing.booking_id,
      existing.property_id
    );

    const nextPercentage =
      input.commissionPercentage !== undefined
        ? input.commissionPercentage
        : existing.commission_percentage !== null
          ? Number(existing.commission_percentage)
          : null;

    const nextOverride =
      input.isManualOverride !== undefined
        ? Boolean(input.isManualOverride)
        : Boolean(existing.is_manual_override);

    let nextFinal = existing.final_amount;
    let nextReason = existing.override_reason;

    if (input.isManualOverride !== undefined || input.finalAmount !== undefined) {
      if (nextOverride) {
        nextFinal =
          input.finalAmount !== undefined
            ? input.finalAmount
            : existing.final_amount;
        nextReason =
          input.overrideReason !== undefined
            ? input.overrideReason
            : existing.override_reason;
        if (!nextReason) {
          throw new ApiError(400, "Override reason required", [
            {
              field: "overrideReason",
              message: "overrideReason is required for manual override",
            },
          ]);
        }
      } else {
        nextReason = null;
      }
    } else if (input.overrideReason !== undefined && nextOverride) {
      nextReason = input.overrideReason;
    }

    if (input.assignedAgentId !== undefined) {
      await assertEmployee(client, input.assignedAgentId);
    }

    const baseAmount = resolveBaseAmount(property, booking);
    const { calculatedAmount, finalAmount } = computeAmounts({
      baseAmount,
      commissionPercentage: nextPercentage,
      isManualOverride: nextOverride,
      finalAmount: nextOverride ? nextFinal : null,
    });

    const brokerageBuyer =
      input.brokerageFromBuyer !== undefined
        ? input.brokerageFromBuyer
        : existing.brokerage_from_buyer;
    const brokerageSeller =
      input.brokerageFromSeller !== undefined
        ? input.brokerageFromSeller
        : existing.brokerage_from_seller;
    const paymentStatus =
      input.paymentStatus !== undefined
        ? input.paymentStatus
        : existing.payment_status;
    const assignedAgentId =
      input.assignedAgentId !== undefined
        ? input.assignedAgentId
        : existing.assigned_agent_id;
    const referralSource =
      input.referralSource !== undefined
        ? input.referralSource
        : existing.referral_source;

    await client.query(
      `UPDATE commissions SET
         commission_percentage = $1,
         calculated_amount = $2,
         final_amount = $3,
         is_manual_override = $4,
         override_reason = $5,
         brokerage_from_buyer = $6,
         brokerage_from_seller = $7,
         payment_status = $8,
         assigned_agent_id = $9,
         referral_source = $10,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 AND deleted_at IS NULL`,
      [
        nextPercentage,
        calculatedAmount,
        finalAmount,
        nextOverride,
        nextOverride ? nextReason : null,
        brokerageBuyer ?? 0,
        brokerageSeller ?? 0,
        paymentStatus,
        assignedAgentId,
        referralSource,
        id,
      ]
    );

    const updated = await getCommissionRow(id, { client });
    await writeAudit(
      client,
      adminId,
      nextOverride && !existing.is_manual_override
        ? "COMMISSION_OVERRIDE"
        : "COMMISSION_UPDATE",
      id,
      toPublicCommission(existing),
      toPublicCommission(updated)
    );

    await client.query("COMMIT");
    return toPublicCommission(updated);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function softDeleteCommission(id, adminId) {
  const existing = await getCommissionRow(id);
  if (!existing) {
    throw new ApiError(404, "Commission not found");
  }

  await pool.query(
    `UPDATE commissions
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND deleted_at IS NULL`,
    [adminId || null, id]
  );

  await writeAudit(pool, adminId, "COMMISSION_SOFT_DELETE", id, {
    deletedAt: null,
  }, {
    deletedAt: new Date().toISOString(),
  });

  const deleted = await getCommissionRow(id, { includeDeleted: true });
  return toPublicCommission(deleted);
}

module.exports = {
  createCommission,
  listCommissions,
  getCommissionById,
  updateCommission,
  softDeleteCommission,
};
