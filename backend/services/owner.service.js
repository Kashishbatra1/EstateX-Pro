/**
 * Owners Management service — uses approved `owners` and `property_owners` schema.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  WRITABLE_FIELDS,
  toPublicOwner,
  toPublicPropertyOwnerLink,
} = require("../utils/ownerMapper");

async function getOwnerRow(id, { includeDeleted = false } = {}) {
  const result = await pool.query(
    `SELECT * FROM owners
     WHERE id = $1
       AND ($2::boolean = TRUE OR deleted_at IS NULL)
     LIMIT 1`,
    [id, includeDeleted]
  );
  return result.rows[0] || null;
}

async function getPropertyRow(propertyId) {
  const result = await pool.query(
    `SELECT id, property_code, title, status, deleted_at
     FROM properties
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [propertyId]
  );
  return result.rows[0] || null;
}

async function getShareTotal(propertyId, { excludeOwnerId = null } = {}) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(share_percentage), 0) AS total
     FROM property_owners
     WHERE property_id = $1
       AND ($2::bigint IS NULL OR owner_id <> $2)`,
    [propertyId, excludeOwnerId]
  );
  return Number(result.rows[0].total);
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

async function createOwner(input) {
  const { columns, values } = buildWritableColumns(input);

  if (!columns.includes("owner_name")) {
    columns.push("owner_name");
    values.push(input.ownerName);
  }

  const placeholders = columns.map((_, i) => `$${i + 1}`);
  try {
    const result = await pool.query(
      `INSERT INTO owners (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING *`,
      values
    );
    return toPublicOwner(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      throw new ApiError(409, "An owner with this CNIC already exists");
    }
    throw err;
  }
}

async function listOwners(query = {}) {
  const {
    search,
    verificationStatus,
    page = 1,
    limit = 20,
  } = query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const where = ["o.deleted_at IS NULL"];
  const params = [];

  function add(sqlFragment, value) {
    params.push(value);
    where.push(sqlFragment.replace("?", `$${params.length}`));
  }

  if (verificationStatus) {
    add("o.verification_status = ?", String(verificationStatus).toLowerCase());
  }

  if (search && String(search).trim()) {
    const term = `%${String(search).trim()}%`;
    params.push(term, term, term, term);
    const i = params.length;
    where.push(
      `(o.owner_name ILIKE $${i - 3}
        OR COALESCE(o.cnic, '') ILIKE $${i - 2}
        OR COALESCE(o.phone, '') ILIKE $${i - 1}
        OR COALESCE(o.email, '') ILIKE $${i})`
    );
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total FROM owners o ${whereSql}`,
    params
  );

  const listParams = [...params, limitNum, offset];
  const listResult = await pool.query(
    `SELECT o.*
     FROM owners o
     ${whereSql}
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  return {
    items: listResult.rows.map((row) => toPublicOwner(row)),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limitNum) || 0,
    },
  };
}

async function getOwnerById(id) {
  const row = await getOwnerRow(id);
  if (!row) throw new ApiError(404, "Owner not found");

  const links = await pool.query(
    `SELECT po.*, p.property_code, p.title AS property_title, p.status AS property_status
     FROM property_owners po
     JOIN properties p ON p.id = po.property_id
     WHERE po.owner_id = $1 AND p.deleted_at IS NULL
     ORDER BY po.created_at DESC`,
    [id]
  );

  return toPublicOwner(row, {
    properties: links.rows.map((r) => ({
      linkId: Number(r.id),
      propertyId: Number(r.property_id),
      propertyCode: r.property_code,
      propertyTitle: r.property_title,
      propertyStatus: r.property_status,
      sharePercentage: Number(r.share_percentage),
      ownershipDocumentType: r.ownership_document_type,
      isPrimary: r.is_primary,
    })),
  });
}

async function updateOwner(id, input) {
  const existing = await getOwnerRow(id);
  if (!existing) throw new ApiError(404, "Owner not found");

  const { columns, values } = buildWritableColumns(input);
  if (!columns.length) {
    throw new ApiError(400, "No updatable fields provided");
  }

  const sets = columns.map((col, i) => `${col} = $${i + 1}`);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE owners
       SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    if (!result.rows[0]) throw new ApiError(404, "Owner not found");
    return toPublicOwner(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      throw new ApiError(409, "An owner with this CNIC already exists");
    }
    throw err;
  }
}

async function updateVerificationStatus(id, verificationStatus, adminId) {
  const existing = await getOwnerRow(id);
  if (!existing) throw new ApiError(404, "Owner not found");

  if (existing.verification_status === verificationStatus) {
    return toPublicOwner(existing);
  }

  const verifiedAt = verificationStatus === "verified" ? new Date().toISOString() : null;
  const verifiedBy = verificationStatus === "verified" ? adminId : null;

  try {
    const result = await pool.query(
      `UPDATE owners
       SET verification_status = $1,
           verified_at = $2,
           verified_by = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING *`,
      [verificationStatus, verifiedAt, verifiedBy, id]
    );

    if (!result.rows[0]) throw new ApiError(404, "Owner not found");

    // Record ownership-related verification impact on linked properties
    await pool.query(
      `INSERT INTO property_history
         (property_id, event_type, old_value, new_value, description, performed_by)
       SELECT po.property_id,
              'ownership_change',
              jsonb_build_object('ownerId', $1::bigint, 'verificationStatus', $2::text),
              jsonb_build_object('ownerId', $1::bigint, 'verificationStatus', $3::text),
              $4,
              $5
       FROM property_owners po
       JOIN properties p ON p.id = po.property_id
       WHERE po.owner_id = $1 AND p.deleted_at IS NULL`,
      [
        id,
        existing.verification_status,
        verificationStatus,
        `Owner verification changed to ${verificationStatus}`,
        adminId,
      ]
    );

    return toPublicOwner(result.rows[0]);
  } catch (err) {
    if (err.code === "23514" || err.code === "P0001") {
      throw new ApiError(
        400,
        err.message || "Cannot change verification status due to listed property rules"
      );
    }
    throw err;
  }
}

async function softDeleteOwner(id, adminId) {
  const existing = await getOwnerRow(id);
  if (!existing) throw new ApiError(404, "Owner not found");

  try {
    const result = await pool.query(
      `UPDATE owners
       SET deleted_at = CURRENT_TIMESTAMP,
           deleted_by = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [adminId, id]
    );
    if (!result.rows[0]) throw new ApiError(404, "Owner not found");
    return {
      id: Number(result.rows[0].id),
      ownerName: result.rows[0].owner_name,
      deletedAt: result.rows[0].deleted_at,
    };
  } catch (err) {
    if (err.code === "23514" || err.code === "P0001") {
      throw new ApiError(
        400,
        err.message || "Cannot delete owner required by a listed property"
      );
    }
    throw err;
  }
}

async function listPropertyOwners(propertyId) {
  const property = await getPropertyRow(propertyId);
  if (!property) throw new ApiError(404, "Property not found");

  const result = await pool.query(
    `SELECT po.*, o.owner_name, o.verification_status, o.cnic, o.phone
     FROM property_owners po
     JOIN owners o ON o.id = po.owner_id
     WHERE po.property_id = $1
     ORDER BY po.is_primary DESC, po.id ASC`,
    [propertyId]
  );

  const shareTotal = await getShareTotal(propertyId);

  return {
    property: {
      id: Number(property.id),
      propertyCode: property.property_code,
      title: property.title,
      status: property.status,
    },
    owners: result.rows.map((row) => ({
      ...toPublicPropertyOwnerLink(row),
      cnic: row.cnic,
      phone: row.phone,
    })),
    shareTotal,
    remainingShare: Math.max(0, Number((100 - shareTotal).toFixed(2))),
  };
}

async function linkOwnerToProperty(propertyId, input, adminId) {
  const property = await getPropertyRow(propertyId);
  if (!property) throw new ApiError(404, "Property not found");

  const owner = await getOwnerRow(input.ownerId);
  if (!owner) throw new ApiError(404, "Owner not found");

  const existingShare = await getShareTotal(propertyId);
  const nextTotal = Number((existingShare + Number(input.sharePercentage)).toFixed(2));
  if (nextTotal > 100) {
    throw new ApiError(400, "Total ownership share cannot exceed 100%", {
      currentShareTotal: existingShare,
      requestedShare: Number(input.sharePercentage),
      resultingTotal: nextTotal,
    });
  }

  // Listed properties must remain at exactly 100% after the change
  if (property.status !== "draft" && nextTotal !== 100) {
    throw new ApiError(
      400,
      "Listed properties require owner share percentages to total exactly 100%",
      { resultingTotal: nextTotal }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (input.isPrimary) {
      await client.query(
        `UPDATE property_owners SET is_primary = FALSE WHERE property_id = $1`,
        [propertyId]
      );
    }

    const insert = await client.query(
      `INSERT INTO property_owners
         (property_id, owner_id, share_percentage, ownership_document_type, is_primary)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        propertyId,
        input.ownerId,
        input.sharePercentage,
        input.ownershipDocumentType || null,
        Boolean(input.isPrimary),
      ]
    );

    await client.query(
      `INSERT INTO property_history
         (property_id, event_type, new_value, description, performed_by)
       VALUES ($1, 'ownership_change', $2::jsonb, $3, $4)`,
      [
        propertyId,
        JSON.stringify({
          action: "link",
          ownerId: input.ownerId,
          ownerName: owner.owner_name,
          sharePercentage: input.sharePercentage,
          ownershipDocumentType: input.ownershipDocumentType || null,
          isPrimary: Boolean(input.isPrimary),
        }),
        `Owner linked to property with ${input.sharePercentage}% share`,
        adminId,
      ]
    );

    await client.query("COMMIT");

    const linked = insert.rows[0];
    return {
      ...toPublicPropertyOwnerLink({
        ...linked,
        owner_name: owner.owner_name,
        verification_status: owner.verification_status,
      }),
      shareTotal: nextTotal,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      throw new ApiError(409, "This owner is already linked to the property");
    }
    if (err.code === "23514" || err.code === "P0001") {
      throw new ApiError(400, err.message || "Owner link rejected by database rules");
    }
    throw err;
  } finally {
    client.release();
  }
}

async function updatePropertyOwnerShare(propertyId, ownerId, input, adminId) {
  const property = await getPropertyRow(propertyId);
  if (!property) throw new ApiError(404, "Property not found");

  const existingLink = await pool.query(
    `SELECT po.*, o.owner_name, o.verification_status
     FROM property_owners po
     JOIN owners o ON o.id = po.owner_id
     WHERE po.property_id = $1 AND po.owner_id = $2
     LIMIT 1`,
    [propertyId, ownerId]
  );
  if (!existingLink.rows[0]) {
    throw new ApiError(404, "Owner is not linked to this property");
  }

  const otherTotal = await getShareTotal(propertyId, { excludeOwnerId: ownerId });
  const nextTotal = Number((otherTotal + Number(input.sharePercentage)).toFixed(2));
  if (nextTotal > 100) {
    throw new ApiError(400, "Total ownership share cannot exceed 100%", {
      currentOtherShares: otherTotal,
      requestedShare: Number(input.sharePercentage),
      resultingTotal: nextTotal,
    });
  }

  if (property.status !== "draft" && nextTotal !== 100) {
    throw new ApiError(
      400,
      "Listed properties require owner share percentages to total exactly 100%",
      { resultingTotal: nextTotal }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (input.isPrimary === true) {
      await client.query(
        `UPDATE property_owners SET is_primary = FALSE WHERE property_id = $1`,
        [propertyId]
      );
    }

    const sets = ["share_percentage = $1"];
    const params = [input.sharePercentage];

    if (input.ownershipDocumentType !== undefined) {
      params.push(input.ownershipDocumentType);
      sets.push(`ownership_document_type = $${params.length}`);
    }
    if (input.isPrimary !== undefined) {
      params.push(Boolean(input.isPrimary));
      sets.push(`is_primary = $${params.length}`);
    }

    params.push(propertyId, ownerId);
    const updated = await client.query(
      `UPDATE property_owners
       SET ${sets.join(", ")}
       WHERE property_id = $${params.length - 1} AND owner_id = $${params.length}
       RETURNING *`,
      params
    );

    await client.query(
      `INSERT INTO property_history
         (property_id, event_type, old_value, new_value, description, performed_by)
       VALUES ($1, 'ownership_change', $2::jsonb, $3::jsonb, $4, $5)`,
      [
        propertyId,
        JSON.stringify({
          ownerId,
          sharePercentage: Number(existingLink.rows[0].share_percentage),
        }),
        JSON.stringify({
          ownerId,
          sharePercentage: Number(input.sharePercentage),
          isPrimary: input.isPrimary,
          ownershipDocumentType: input.ownershipDocumentType,
        }),
        "Property ownership share updated",
        adminId,
      ]
    );

    await client.query("COMMIT");

    const row = updated.rows[0];
    return {
      ...toPublicPropertyOwnerLink({
        ...row,
        owner_name: existingLink.rows[0].owner_name,
        verification_status: existingLink.rows[0].verification_status,
      }),
      shareTotal: nextTotal,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23514" || err.code === "P0001") {
      throw new ApiError(400, err.message || "Share update rejected by database rules");
    }
    throw err;
  } finally {
    client.release();
  }
}

async function unlinkOwnerFromProperty(propertyId, ownerId, adminId) {
  const property = await getPropertyRow(propertyId);
  if (!property) throw new ApiError(404, "Property not found");

  const existingLink = await pool.query(
    `SELECT po.*, o.owner_name
     FROM property_owners po
     JOIN owners o ON o.id = po.owner_id
     WHERE po.property_id = $1 AND po.owner_id = $2
     LIMIT 1`,
    [propertyId, ownerId]
  );
  if (!existingLink.rows[0]) {
    throw new ApiError(404, "Owner is not linked to this property");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM property_owners WHERE property_id = $1 AND owner_id = $2`,
      [propertyId, ownerId]
    );

    await client.query(
      `INSERT INTO property_history
         (property_id, event_type, old_value, new_value, description, performed_by)
       VALUES ($1, 'ownership_change', $2::jsonb, $3::jsonb, $4, $5)`,
      [
        propertyId,
        JSON.stringify({
          action: "unlink",
          ownerId,
          ownerName: existingLink.rows[0].owner_name,
          sharePercentage: Number(existingLink.rows[0].share_percentage),
        }),
        JSON.stringify({ action: "unlinked", ownerId }),
        "Owner unlinked from property",
        adminId,
      ]
    );

    await client.query("COMMIT");

    const remaining = await getShareTotal(propertyId);
    return {
      propertyId,
      ownerId,
      unlinked: true,
      remainingShareTotal: remaining,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23514" || err.code === "P0001") {
      throw new ApiError(
        400,
        err.message || "Cannot unlink owner from listed property under current ownership rules"
      );
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createOwner,
  listOwners,
  getOwnerById,
  updateOwner,
  updateVerificationStatus,
  softDeleteOwner,
  listPropertyOwners,
  linkOwnerToProperty,
  updatePropertyOwnerShare,
  unlinkOwnerFromProperty,
};
