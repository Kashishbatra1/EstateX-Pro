/**
 * Resale & Transfer service — approved `property_transfers` table only.
 *
 * Ownership-apply is intentionally NOT implemented in Phase 23:
 * applying live property_owners changes needs extra share/listing rules
 * beyond a safe thin CRUD layer.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  toPublicTransfer,
  TRANSFER_TYPES,
} = require("../utils/transferMapper");

const TRANSFER_SELECT = `
  SELECT t.*,
         p.property_code,
         p.title AS property_title,
         p.status AS property_status,
         fo.owner_name AS from_owner_name,
         too.owner_name AS to_owner_name,
         fc.client_name AS from_client_name,
         tc.client_name AS to_client_name
  FROM property_transfers t
  JOIN properties p ON p.id = t.property_id
  LEFT JOIN owners fo ON fo.id = t.from_owner_id
  LEFT JOIN owners too ON too.id = t.to_owner_id
  LEFT JOIN clients fc ON fc.id = t.from_client_id
  LEFT JOIN clients tc ON tc.id = t.to_client_id
`;

async function writeAudit(clientOrPool, adminId, action, entityId, oldData, newData) {
  await clientOrPool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, 'property_transfer', $3, $4::jsonb, $5::jsonb)`,
    [
      adminId || null,
      action,
      entityId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
    ]
  );
}

async function writeTransferHistory(client, propertyId, adminId, description, oldValue, newValue) {
  await client.query(
    `INSERT INTO property_history
       (property_id, event_type, old_value, new_value, description, performed_by)
     VALUES ($1, 'transfer', $2::jsonb, $3::jsonb, $4, $5)`,
    [
      propertyId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      description,
      adminId || null,
    ]
  );
}

async function getTransferRow(id, { includeDeleted = false, client = pool } = {}) {
  const where = includeDeleted
    ? "t.id = $1"
    : "t.id = $1 AND t.deleted_at IS NULL";
  const result = await client.query(
    `${TRANSFER_SELECT} WHERE ${where} LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function assertProperty(client, propertyId) {
  const result = await client.query(
    `SELECT id, property_code, title, status, deleted_at
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

async function assertOwner(client, ownerId, field) {
  if (!ownerId) return null;
  const result = await client.query(
    `SELECT id, owner_name, deleted_at FROM owners WHERE id = $1 LIMIT 1`,
    [ownerId]
  );
  const row = result.rows[0];
  if (!row || row.deleted_at) {
    throw new ApiError(400, "Owner not found", [
      { field, message: "Valid active owner is required" },
    ]);
  }
  return row;
}

async function assertClient(client, clientId, field) {
  if (!clientId) return null;
  const result = await client.query(
    `SELECT id, client_name, deleted_at FROM clients WHERE id = $1 LIMIT 1`,
    [clientId]
  );
  const row = result.rows[0];
  if (!row || row.deleted_at) {
    throw new ApiError(400, "Client not found", [
      { field, message: "Valid active client is required" },
    ]);
  }
  return row;
}

async function buildOwnerSnapshot(client, propertyId) {
  const result = await client.query(
    `SELECT po.id AS property_owner_id,
            po.owner_id,
            po.share_percentage,
            po.is_primary,
            po.ownership_document_type,
            o.owner_name,
            o.cnic,
            o.verification_status
     FROM property_owners po
     JOIN owners o ON o.id = po.owner_id
     WHERE po.property_id = $1
       AND o.deleted_at IS NULL
     ORDER BY po.is_primary DESC, po.id ASC`,
    [propertyId]
  );

  // Empty ownership is schema-valid; capture historical empty state.
  return {
    capturedAt: new Date().toISOString(),
    owners: result.rows.map((r) => ({
      propertyOwnerId: Number(r.property_owner_id),
      ownerId: Number(r.owner_id),
      ownerName: r.owner_name,
      cnic: r.cnic || null,
      sharePercentage: Number(r.share_percentage),
      isPrimary: Boolean(r.is_primary),
      ownershipDocumentType: r.ownership_document_type || null,
      verificationStatus: r.verification_status || null,
    })),
  };
}

async function createTransfer(input, adminId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await assertProperty(client, input.propertyId);
    await assertOwner(client, input.fromOwnerId, "fromOwnerId");
    await assertOwner(client, input.toOwnerId, "toOwnerId");
    await assertClient(client, input.fromClientId, "fromClientId");
    await assertClient(client, input.toClientId, "toClientId");

    if (!TRANSFER_TYPES.includes(input.transferType)) {
      throw new ApiError(400, "Invalid transfer type", [
        { field: "transferType", message: "Must be resale or transfer" },
      ]);
    }

    const snapshot = await buildOwnerSnapshot(client, input.propertyId);
    const transferDate =
      input.transferDate || new Date().toISOString().slice(0, 10);

    const inserted = await client.query(
      `INSERT INTO property_transfers (
         property_id, transfer_type,
         from_owner_id, to_owner_id, from_client_id, to_client_id,
         transfer_charges, lease_charges, transfer_tax, stamp_duty,
         noc_for_transfer, noc_status, noc_document_path,
         transfer_date, previous_owner_snapshot, notes, created_by
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15::jsonb, $16, $17
       )
       RETURNING id`,
      [
        input.propertyId,
        input.transferType,
        input.fromOwnerId || null,
        input.toOwnerId || null,
        input.fromClientId || null,
        input.toClientId || null,
        input.transferCharges ?? 0,
        input.leaseCharges ?? 0,
        input.transferTax ?? 0,
        input.stampDuty ?? 0,
        Boolean(input.nocForTransfer),
        input.nocStatus || null,
        input.nocDocumentPath || null,
        transferDate,
        JSON.stringify(snapshot),
        input.notes || null,
        adminId || null,
      ]
    );

    const id = inserted.rows[0].id;
    const row = await getTransferRow(id, { client });
    const publicRow = toPublicTransfer(row);

    await writeAudit(client, adminId, "TRANSFER_CREATE", id, null, {
      id,
      propertyId: input.propertyId,
      transferType: input.transferType,
      transferDate,
    });

    await writeTransferHistory(
      client,
      input.propertyId,
      adminId,
      `${input.transferType} recorded for property`,
      null,
      {
        transferId: id,
        transferType: input.transferType,
        transferDate,
        previousOwnerSnapshot: snapshot,
      }
    );

    await client.query("COMMIT");
    return publicRow;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listTransfers(query = {}) {
  const {
    search,
    propertyId,
    transferType,
    fromOwnerId,
    toOwnerId,
    fromClientId,
    toClientId,
    transferFrom,
    transferTo,
    page = 1,
    limit = 20,
  } = query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const params = [];
  const where = ["t.deleted_at IS NULL"];

  function add(clause, value) {
    params.push(value);
    where.push(clause.replace("?", `$${params.length}`));
  }

  if (propertyId) add("t.property_id = ?", Number(propertyId));
  if (transferType) {
    const t = String(transferType).toLowerCase();
    if (TRANSFER_TYPES.includes(t)) add("t.transfer_type = ?", t);
  }
  if (fromOwnerId) add("t.from_owner_id = ?", Number(fromOwnerId));
  if (toOwnerId) add("t.to_owner_id = ?", Number(toOwnerId));
  if (fromClientId) add("t.from_client_id = ?", Number(fromClientId));
  if (toClientId) add("t.to_client_id = ?", Number(toClientId));
  if (transferFrom) add("t.transfer_date >= ?", String(transferFrom));
  if (transferTo) add("t.transfer_date <= ?", String(transferTo));

  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    params.push(q);
    const i = params.length;
    where.push(
      `(p.property_code ILIKE $${i}
        OR p.title ILIKE $${i}
        OR fo.owner_name ILIKE $${i}
        OR too.owner_name ILIKE $${i}
        OR fc.client_name ILIKE $${i}
        OR tc.client_name ILIKE $${i}
        OR t.notes ILIKE $${i}
        OR t.noc_status ILIKE $${i})`
    );
  }

  const whereSql = where.join(" AND ");
  const countResult = await pool.query(
    `SELECT COUNT(*)::INT AS total
     FROM property_transfers t
     JOIN properties p ON p.id = t.property_id
     LEFT JOIN owners fo ON fo.id = t.from_owner_id
     LEFT JOIN owners too ON too.id = t.to_owner_id
     LEFT JOIN clients fc ON fc.id = t.from_client_id
     LEFT JOIN clients tc ON tc.id = t.to_client_id
     WHERE ${whereSql}`,
    params
  );
  const total = countResult.rows[0].total;

  const listParams = [...params, limitNum, offset];
  const listResult = await pool.query(
    `${TRANSFER_SELECT}
     WHERE ${whereSql}
     ORDER BY t.transfer_date DESC, t.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    listParams
  );

  return {
    items: listResult.rows.map(toPublicTransfer),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    },
  };
}

async function getTransferById(id) {
  const row = await getTransferRow(id);
  if (!row) {
    throw new ApiError(404, "Transfer not found");
  }
  return toPublicTransfer(row);
}

async function listTransfersForProperty(propertyId) {
  await assertProperty(pool, propertyId);
  return listTransfers({ propertyId, page: 1, limit: 100 });
}

async function updateTransfer(id, input, adminId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await getTransferRow(id, { client });
    if (!existing) {
      throw new ApiError(404, "Transfer not found");
    }

    if (input.fromOwnerId !== undefined) {
      await assertOwner(client, input.fromOwnerId, "fromOwnerId");
    }
    if (input.toOwnerId !== undefined) {
      await assertOwner(client, input.toOwnerId, "toOwnerId");
    }
    if (input.fromClientId !== undefined) {
      await assertClient(client, input.fromClientId, "fromClientId");
    }
    if (input.toClientId !== undefined) {
      await assertClient(client, input.toClientId, "toClientId");
    }

    const next = {
      transferType:
        input.transferType !== undefined
          ? input.transferType
          : existing.transfer_type,
      fromOwnerId:
        input.fromOwnerId !== undefined
          ? input.fromOwnerId
          : existing.from_owner_id,
      toOwnerId:
        input.toOwnerId !== undefined ? input.toOwnerId : existing.to_owner_id,
      fromClientId:
        input.fromClientId !== undefined
          ? input.fromClientId
          : existing.from_client_id,
      toClientId:
        input.toClientId !== undefined
          ? input.toClientId
          : existing.to_client_id,
      transferCharges:
        input.transferCharges !== undefined
          ? input.transferCharges
          : existing.transfer_charges,
      leaseCharges:
        input.leaseCharges !== undefined
          ? input.leaseCharges
          : existing.lease_charges,
      transferTax:
        input.transferTax !== undefined
          ? input.transferTax
          : existing.transfer_tax,
      stampDuty:
        input.stampDuty !== undefined ? input.stampDuty : existing.stamp_duty,
      nocForTransfer:
        input.nocForTransfer !== undefined
          ? Boolean(input.nocForTransfer)
          : Boolean(existing.noc_for_transfer),
      nocStatus:
        input.nocStatus !== undefined ? input.nocStatus : existing.noc_status,
      nocDocumentPath:
        input.nocDocumentPath !== undefined
          ? input.nocDocumentPath
          : existing.noc_document_path,
      transferDate:
        input.transferDate !== undefined
          ? input.transferDate
          : existing.transfer_date,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    };

    await client.query(
      `UPDATE property_transfers SET
         transfer_type = $1,
         from_owner_id = $2,
         to_owner_id = $3,
         from_client_id = $4,
         to_client_id = $5,
         transfer_charges = $6,
         lease_charges = $7,
         transfer_tax = $8,
         stamp_duty = $9,
         noc_for_transfer = $10,
         noc_status = $11,
         noc_document_path = $12,
         transfer_date = $13,
         notes = $14,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $15 AND deleted_at IS NULL`,
      [
        next.transferType,
        next.fromOwnerId,
        next.toOwnerId,
        next.fromClientId,
        next.toClientId,
        next.transferCharges ?? 0,
        next.leaseCharges ?? 0,
        next.transferTax ?? 0,
        next.stampDuty ?? 0,
        next.nocForTransfer,
        next.nocStatus,
        next.nocDocumentPath,
        next.transferDate,
        next.notes,
        id,
      ]
    );

    const updated = await getTransferRow(id, { client });
    const publicOld = toPublicTransfer(existing);
    const publicNew = toPublicTransfer(updated);

    await writeAudit(
      client,
      adminId,
      "TRANSFER_UPDATE",
      id,
      publicOld,
      publicNew
    );

    await writeTransferHistory(
      client,
      existing.property_id,
      adminId,
      "Transfer record updated",
      { transferId: id, ...publicOld },
      { transferId: id, ...publicNew }
    );

    await client.query("COMMIT");
    return publicNew;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function softDeleteTransfer(id, adminId) {
  const existing = await getTransferRow(id);
  if (!existing) {
    throw new ApiError(404, "Transfer not found");
  }

  await pool.query(
    `UPDATE property_transfers
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND deleted_at IS NULL`,
    [adminId || null, id]
  );

  await writeAudit(
    pool,
    adminId,
    "TRANSFER_SOFT_DELETE",
    id,
    { deletedAt: null },
    { deletedAt: new Date().toISOString() }
  );

  const deleted = await getTransferRow(id, { includeDeleted: true });
  return toPublicTransfer(deleted);
}

module.exports = {
  createTransfer,
  listTransfers,
  getTransferById,
  listTransfersForProperty,
  updateTransfer,
  softDeleteTransfer,
};
