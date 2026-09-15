/**
 * Property Inventory service — uses approved `properties` schema.
 * Listing rules are enforced by PostgreSQL triggers/constraints; this layer
 * adds clear API errors and soft-delete behavior.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  WRITABLE_FIELDS,
  toPublicProperty,
  toPublicFeatures,
  emptyFeatures,
  normalizeFeaturesInput,
} = require("../utils/propertyMapper");

async function getPropertyRow(id, { includeDeleted = false } = {}) {
  const result = await pool.query(
    `SELECT * FROM properties
     WHERE id = $1
       AND ($2::boolean = TRUE OR deleted_at IS NULL)
     LIMIT 1`,
    [id, includeDeleted]
  );
  return result.rows[0] || null;
}

async function getPropertyOwners(propertyId) {
  const result = await pool.query(
    `SELECT po.id, po.owner_id, po.share_percentage, po.ownership_document_type,
            po.is_primary, o.owner_name, o.verification_status
     FROM property_owners po
     JOIN owners o ON o.id = po.owner_id
     WHERE po.property_id = $1
     ORDER BY po.is_primary DESC, po.id ASC`,
    [propertyId]
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    ownerId: Number(row.owner_id),
    ownerName: row.owner_name,
    verificationStatus: row.verification_status,
    sharePercentage: Number(row.share_percentage),
    ownershipDocumentType: row.ownership_document_type,
    isPrimary: row.is_primary,
  }));
}

async function getPropertyBanks(propertyId) {
  const result = await pool.query(
    `SELECT pba.id, pba.bank_account_id, pba.is_primary,
            ba.bank_name, ba.account_holder_name, ba.account_number, ba.is_active
     FROM property_bank_accounts pba
     JOIN bank_accounts ba ON ba.id = pba.bank_account_id
     WHERE pba.property_id = $1
     ORDER BY pba.is_primary DESC, pba.id ASC`,
    [propertyId]
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    bankAccountId: Number(row.bank_account_id),
    bankName: row.bank_name,
    accountHolderName: row.account_holder_name,
    accountNumber: row.account_number,
    isActive: row.is_active,
    isPrimary: row.is_primary,
  }));
}

async function getListingReadiness(propertyId) {
  const result = await pool.query(
    `SELECT
       EXISTS (
         SELECT 1
         FROM property_owners po
         JOIN owners o ON o.id = po.owner_id
         WHERE po.property_id = $1
           AND o.verification_status = 'verified'
           AND o.deleted_at IS NULL
       ) AS has_verified_owner,
       EXISTS (
         SELECT 1
         FROM property_bank_accounts pba
         JOIN bank_accounts ba ON ba.id = pba.bank_account_id
         WHERE pba.property_id = $1
           AND ba.deleted_at IS NULL
           AND ba.is_active = TRUE
       ) AS has_bank_account,
       COALESCE((
         SELECT SUM(share_percentage)
         FROM property_owners
         WHERE property_id = $1
       ), 0) AS share_total,
       p.primary_payment_method_id IS NOT NULL AS has_payment_method,
       p.purpose,
       p.monthly_rent,
       p.advance_rent_months,
       p.security_deposit
     FROM properties p
     WHERE p.id = $1`,
    [propertyId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const rentOk =
    row.purpose !== "rent" ||
    (row.monthly_rent !== null &&
      row.advance_rent_months !== null &&
      row.security_deposit !== null);

  return {
    hasVerifiedOwner: row.has_verified_owner,
    hasBankAccount: row.has_bank_account,
    hasPaymentMethod: row.has_payment_method,
    ownerShareTotal: Number(row.share_total),
    rentFieldsComplete: rentOk,
    canList:
      row.has_verified_owner &&
      row.has_bank_account &&
      row.has_payment_method &&
      Number(row.share_total) === 100 &&
      rentOk,
  };
}

async function getPaymentMethodName(paymentMethodId) {
  if (!paymentMethodId) return null;
  const result = await pool.query(
    `SELECT method_name FROM payment_methods WHERE id = $1 LIMIT 1`,
    [paymentMethodId]
  );
  return result.rows[0]?.method_name || null;
}

/** Installment plan lives on bookings (approved schema); surface latest for property UI. */
async function getPropertyInstallmentSummary(propertyId) {
  const result = await pool.query(
    `SELECT id, booking_code, status,
            installment_plan_name, monthly_installment_amount
     FROM bookings
     WHERE property_id = $1
       AND deleted_at IS NULL
       AND (
         installment_plan_name IS NOT NULL
         OR monthly_installment_amount IS NOT NULL
       )
     ORDER BY created_at DESC
     LIMIT 1`,
    [propertyId]
  );
  const row = result.rows[0];
  if (!row) {
    return {
      installmentsEnabled: false,
      installmentPlanName: null,
      monthlyInstallmentAmount: null,
      bookingId: null,
      bookingCode: null,
      bookingStatus: null,
    };
  }
  return {
    installmentsEnabled: true,
    installmentPlanName: row.installment_plan_name,
    monthlyInstallmentAmount:
      row.monthly_installment_amount !== null
        ? Number(row.monthly_installment_amount)
        : null,
    bookingId: Number(row.id),
    bookingCode: row.booking_code,
    bookingStatus: row.status,
  };
}

async function getPropertyFeatures(propertyId, db = pool) {
  try {
    const result = await db.query(
      `SELECT * FROM property_features WHERE property_id = $1 LIMIT 1`,
      [propertyId]
    );
    return toPublicFeatures(result.rows[0] || null);
  } catch (err) {
    // Table may not exist yet on older DBs before migration
    if (err.code === "42P01") return emptyFeatures();
    throw err;
  }
}

async function upsertPropertyFeatures(propertyId, featuresInput, db = pool) {
  if (!featuresInput) return;
  const current = await getPropertyFeatures(propertyId, db);
  const merged = { ...current, ...featuresInput };

  await db.query(
    `INSERT INTO property_features (
       property_id, parking, parking_capacity, security, lift, gym, pool,
       garden, generator, solar, water_supply, appliances
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
     )
     ON CONFLICT (property_id) DO UPDATE SET
       parking = EXCLUDED.parking,
       parking_capacity = EXCLUDED.parking_capacity,
       security = EXCLUDED.security,
       lift = EXCLUDED.lift,
       gym = EXCLUDED.gym,
       pool = EXCLUDED.pool,
       garden = EXCLUDED.garden,
       generator = EXCLUDED.generator,
       solar = EXCLUDED.solar,
       water_supply = EXCLUDED.water_supply,
       appliances = EXCLUDED.appliances,
       updated_at = CURRENT_TIMESTAMP`,
    [
      propertyId,
      Boolean(merged.parking),
      merged.parkingCapacity,
      Boolean(merged.security),
      Boolean(merged.lift),
      Boolean(merged.gym),
      Boolean(merged.pool),
      Boolean(merged.garden),
      Boolean(merged.generator),
      Boolean(merged.solar),
      merged.waterSupply,
      merged.appliances,
    ]
  );
}

async function toDetailedProperty(row) {
  const [
    owners,
    bankAccounts,
    listingReadiness,
    primaryPaymentMethodName,
    installmentSummary,
    features,
  ] = await Promise.all([
    getPropertyOwners(row.id),
    getPropertyBanks(row.id),
    getListingReadiness(row.id),
    getPaymentMethodName(row.primary_payment_method_id),
    getPropertyInstallmentSummary(row.id),
    getPropertyFeatures(row.id),
  ]);
  return toPublicProperty(row, {
    owners,
    bankAccounts,
    listingReadiness,
    primaryPaymentMethodName,
    installmentSummary,
    features,
  });
}

function buildWritableColumns(input) {
  const columns = [];
  const values = [];

  for (const [apiKey, dbCol] of Object.entries(WRITABLE_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(input, apiKey)) {
      let value = input[apiKey];
      if (value === "") value = null;
      columns.push(dbCol);
      values.push(value);
    }
  }

  return { columns, values };
}

/** Normalize numeric money fields for change detection (PG may return strings). */
function moneyEquals(a, b) {
  if (a === null || a === undefined || a === "") {
    return b === null || b === undefined || b === "";
  }
  if (b === null || b === undefined || b === "") return false;
  return Number(a) === Number(b);
}

/**
 * Detect asking price / monthly rent changes for property_event_type_enum price_update.
 * Official Module 10: Price Updates.
 */
function detectPriceChanges(existing, columns, values) {
  const priceCols = ["asking_price", "monthly_rent"];
  const oldValue = {};
  const newValue = {};
  let changed = false;

  for (const col of priceCols) {
    const idx = columns.indexOf(col);
    if (idx === -1) continue;
    const prev = existing[col];
    const next = values[idx];
    if (!moneyEquals(prev, next)) {
      changed = true;
      oldValue[col === "asking_price" ? "askingPrice" : "monthlyRent"] =
        prev !== null && prev !== undefined ? Number(prev) : null;
      newValue[col === "asking_price" ? "askingPrice" : "monthlyRent"] =
        next !== null && next !== undefined && next !== ""
          ? Number(next)
          : null;
    }
  }

  return changed ? { oldValue, newValue } : null;
}

function hasNonPriceUpdates(columns) {
  return columns.some((col) => col !== "asking_price" && col !== "monthly_rent");
}

async function createProperty(input, adminId) {
  const featuresInput = normalizeFeaturesInput(input);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const payload = { ...input, status: "draft" };
    delete payload.features;
    const { columns, values } = buildWritableColumns(payload);

    // Ensure required columns always present
    const required = {
      title: payload.title,
      purpose: payload.purpose,
      category: payload.category,
      status: "draft",
      created_by: adminId,
    };

    for (const [col, val] of Object.entries(required)) {
      const idx = columns.indexOf(col);
      if (idx === -1) {
        columns.push(col);
        values.push(val);
      } else {
        values[idx] = val;
      }
    }

    const placeholders = columns.map((_, i) => `$${i + 1}`);
    const insert = await client.query(
      `INSERT INTO properties (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING *`,
      values
    );

    const property = insert.rows[0];

    if (featuresInput) {
      await upsertPropertyFeatures(property.id, featuresInput, client);
    }

    await client.query(
      `INSERT INTO property_history
         (property_id, event_type, new_value, description, performed_by)
       VALUES ($1, 'created', $2::jsonb, $3, $4)`,
      [
        property.id,
        JSON.stringify({
          status: property.status,
          propertyCode: property.property_code,
          title: property.title,
        }),
        "Property created as draft",
        adminId,
      ]
    );

    await client.query("COMMIT");
    return toDetailedProperty(property);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listProperties(query = {}) {
  const {
    status,
    city,
    area,
    category,
    propertyType,
    purpose,
    search,
    featured,
    page = 1,
    limit = 20,
  } = query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const where = ["p.deleted_at IS NULL"];
  const params = [];

  function addFilter(sql, value) {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  }

  if (status) addFilter("p.status = ?", String(status).toLowerCase());
  if (city) addFilter("LOWER(p.city) = LOWER(?)", city);
  if (area) addFilter("LOWER(p.area) = LOWER(?)", area);
  if (category) addFilter("p.category = ?", String(category).toLowerCase());
  if (propertyType) addFilter("LOWER(p.property_type) = LOWER(?)", propertyType);
  if (purpose) addFilter("p.purpose = ?", String(purpose).toLowerCase());
  if (featured === "true" || featured === true) {
    where.push("p.is_featured = TRUE");
  }

  if (search && String(search).trim()) {
    const term = `%${String(search).trim()}%`;
    params.push(term, term, term, term, term);
    const i = params.length;
    where.push(
      `(p.title ILIKE $${i - 4}
        OR p.property_code ILIKE $${i - 3}
        OR COALESCE(p.city, '') ILIKE $${i - 2}
        OR COALESCE(p.area, '') ILIKE $${i - 1}
        OR COALESCE(p.society, '') ILIKE $${i})`
    );
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total FROM properties p ${whereSql}`,
    params
  );

  const listParams = [...params, limitNum, offset];
  const listResult = await pool.query(
    `SELECT p.*
     FROM properties p
     ${whereSql}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  return {
    items: listResult.rows.map((row) => toPublicProperty(row)),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limitNum) || 0,
    },
  };
}

async function getPropertyById(id) {
  const row = await getPropertyRow(id);
  if (!row) {
    throw new ApiError(404, "Property not found");
  }
  return toDetailedProperty(row);
}

async function updateProperty(id, input, adminId) {
  const existing = await getPropertyRow(id);
  if (!existing) {
    throw new ApiError(404, "Property not found");
  }

  const featuresInput = normalizeFeaturesInput(input);
  const propertyInput = { ...input };
  delete propertyInput.features;

  const { columns, values } = buildWritableColumns(propertyInput);
  if (!columns.length && !featuresInput) {
    throw new ApiError(400, "No updatable fields provided");
  }

  // Prevent status changes through update
  const statusIdx = columns.indexOf("status");
  if (statusIdx !== -1) {
    throw new ApiError(400, "Use PATCH /api/properties/:id/status to change status");
  }

  const priceChange = columns.length
    ? detectPriceChanges(existing, columns, values)
    : null;
  const otherFieldsChanged = columns.length
    ? hasNonPriceUpdates(columns)
    : Boolean(featuresInput);

  try {
    let updatedRow = existing;

    if (columns.length) {
      const sets = columns.map((col, i) => `${col} = $${i + 1}`);
      const updateValues = [...values, id];
      const result = await pool.query(
        `UPDATE properties
         SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${updateValues.length} AND deleted_at IS NULL
         RETURNING *`,
        updateValues
      );

      if (!result.rows[0]) {
        throw new ApiError(404, "Property not found");
      }
      updatedRow = result.rows[0];
    }

    if (featuresInput) {
      await upsertPropertyFeatures(id, featuresInput);
    }

    if (priceChange) {
      await pool.query(
        `INSERT INTO property_history
           (property_id, event_type, old_value, new_value, description, performed_by)
         VALUES ($1, 'price_update', $2::jsonb, $3::jsonb, $4, $5)`,
        [
          id,
          JSON.stringify(priceChange.oldValue),
          JSON.stringify(priceChange.newValue),
          "Property price updated",
          adminId,
        ]
      );
    }

    if (otherFieldsChanged || !priceChange) {
      await pool.query(
        `INSERT INTO property_history
           (property_id, event_type, old_value, new_value, description, performed_by)
         VALUES ($1, 'other', $2::jsonb, $3::jsonb, $4, $5)`,
        [
          id,
          JSON.stringify({ note: "Property details updated" }),
          JSON.stringify(input),
          "Property details updated",
          adminId,
        ]
      );
    }

    return toDetailedProperty(updatedRow);
  } catch (err) {
    if (err.code === "23514") {
      throw new ApiError(400, err.message || "Property update failed database checks");
    }
    if (err.code === "42P01") {
      throw new ApiError(
        500,
        "Property features table is missing. Run database/migrations/add_property_features.sql"
      );
    }
    throw err;
  }
}

async function changePropertyStatus(id, newStatus, adminId) {
  const existing = await getPropertyRow(id);
  if (!existing) {
    throw new ApiError(404, "Property not found");
  }

  if (existing.status === newStatus) {
    return toDetailedProperty(existing);
  }

  if (newStatus !== "draft") {
    const readiness = await getListingReadiness(id);
    if (!readiness.canList) {
      const missing = [];
      if (!readiness.hasVerifiedOwner) missing.push("verified owner");
      if (!readiness.hasBankAccount) missing.push("active bank account");
      if (!readiness.hasPaymentMethod) missing.push("payment method");
      if (readiness.ownerShareTotal !== 100) {
        missing.push(`owner shares totaling 100% (current: ${readiness.ownerShareTotal})`);
      }
      if (!readiness.rentFieldsComplete) {
        missing.push("rental fields (monthlyRent, advanceRentMonths, securityDeposit)");
      }
      throw new ApiError(
        400,
        "Property cannot leave draft until listing prerequisites are complete",
        { missing, listingReadiness: readiness }
      );
    }
  }

  try {
    const result = await pool.query(
      `UPDATE properties
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [newStatus, id]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "Property not found");
    }

    await pool.query(
      `INSERT INTO property_history
         (property_id, event_type, old_value, new_value, description, performed_by)
       VALUES ($1, 'status_change', $2::jsonb, $3::jsonb, $4, $5)`,
      [
        id,
        JSON.stringify({ status: existing.status }),
        JSON.stringify({ status: newStatus }),
        `Status changed from ${existing.status} to ${newStatus}`,
        adminId,
      ]
    );

    return toDetailedProperty(result.rows[0]);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.code === "23514" || err.code === "P0001") {
      throw new ApiError(400, err.message || "Status change rejected by database rules");
    }
    throw err;
  }
}

async function softDeleteProperty(id, adminId) {
  const existing = await getPropertyRow(id);
  if (!existing) {
    throw new ApiError(404, "Property not found");
  }

  const result = await pool.query(
    `UPDATE properties
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [adminId, id]
  );

  if (!result.rows[0]) {
    throw new ApiError(404, "Property not found");
  }

  await pool.query(
    `INSERT INTO property_history
       (property_id, event_type, old_value, new_value, description, performed_by)
     VALUES ($1, 'other', $2::jsonb, $3::jsonb, $4, $5)`,
    [
      id,
      JSON.stringify({ deletedAt: null }),
      JSON.stringify({ deletedAt: result.rows[0].deleted_at }),
      "Property moved to recycle bin (soft delete)",
      adminId,
    ]
  );

  return {
    id: Number(result.rows[0].id),
    propertyCode: result.rows[0].property_code,
    deletedAt: result.rows[0].deleted_at,
  };
}

module.exports = {
  createProperty,
  listProperties,
  getPropertyById,
  updateProperty,
  changePropertyStatus,
  softDeleteProperty,
  getListingReadiness,
};
