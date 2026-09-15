/**
 * Property Documents & Media service — approved property_documents / property_media tables.
 * Registers path/URL metadata (same pattern as client KYC). Writes property_history events.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  toPublicDocument,
  toPublicMedia,
} = require("../utils/propertyDocumentMapper");

async function writeAudit(clientOrPool, adminId, action, entityType, entityId, oldData, newData) {
  await clientOrPool.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
    [
      adminId,
      action,
      entityType,
      entityId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
    ]
  );
}

async function assertProperty(propertyId) {
  const result = await pool.query(
    `SELECT id FROM properties WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [propertyId]
  );
  if (!result.rows[0]) {
    throw new ApiError(404, "Property not found");
  }
}

async function writeHistory(clientOrPool, propertyId, eventType, description, adminId, newValue) {
  await clientOrPool.query(
    `INSERT INTO property_history
       (property_id, event_type, new_value, description, performed_by)
     VALUES ($1, $2, $3::jsonb, $4, $5)`,
    [propertyId, eventType, JSON.stringify(newValue), description, adminId]
  );
}

/* ------------------------------ Documents ------------------------------ */

async function listDocuments(propertyId, query = {}) {
  await assertProperty(propertyId);
  const { documentType } = query;
  const where = ["pd.property_id = $1", "pd.deleted_at IS NULL"];
  const params = [propertyId];

  if (documentType) {
    params.push(String(documentType).toLowerCase());
    where.push(`pd.document_type = $${params.length}`);
  }

  const result = await pool.query(
    `SELECT pd.*, a.full_name AS uploaded_by_name
     FROM property_documents pd
     LEFT JOIN admins a ON a.id = pd.uploaded_by
     WHERE ${where.join(" AND ")}
     ORDER BY pd.upload_date DESC, pd.id DESC`,
    params
  );

  return {
    propertyId: Number(propertyId),
    items: result.rows.map(toPublicDocument),
  };
}

async function getDocument(propertyId, documentId) {
  await assertProperty(propertyId);
  const result = await pool.query(
    `SELECT pd.*, a.full_name AS uploaded_by_name
     FROM property_documents pd
     LEFT JOIN admins a ON a.id = pd.uploaded_by
     WHERE pd.id = $1 AND pd.property_id = $2 AND pd.deleted_at IS NULL
     LIMIT 1`,
    [documentId, propertyId]
  );
  if (!result.rows[0]) throw new ApiError(404, "Document not found");
  return toPublicDocument(result.rows[0]);
}

async function createDocument(propertyId, input, adminId) {
  await assertProperty(propertyId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insert = await client.query(
      `INSERT INTO property_documents
         (property_id, document_type, document_name, file_path, file_name,
          mime_type, expiry_date, notes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        propertyId,
        input.documentType,
        input.documentName || null,
        input.filePath,
        input.fileName || null,
        input.mimeType || null,
        input.expiryDate || null,
        input.notes || null,
        adminId,
      ]
    );

    const row = insert.rows[0];
    const publicDoc = toPublicDocument(row);

    await writeHistory(
      client,
      propertyId,
      "document_upload",
      `Document registered: ${row.document_type}`,
      adminId,
      {
        documentId: Number(row.id),
        documentType: row.document_type,
        documentName: row.document_name,
        filePath: row.file_path,
        fileName: row.file_name,
      }
    );

    await writeAudit(
      client,
      adminId,
      "PROPERTY_DOCUMENT_CREATE",
      "property_documents",
      row.id,
      null,
      publicDoc
    );

    await client.query("COMMIT");
    return publicDoc;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function updateDocument(propertyId, documentId, input, adminId) {
  await assertProperty(propertyId);

  const existing = await pool.query(
    `SELECT * FROM property_documents
     WHERE id = $1 AND property_id = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [documentId, propertyId]
  );
  if (!existing.rows[0]) throw new ApiError(404, "Document not found");
  const prev = existing.rows[0];

  const fields = {
    document_type: input.documentType,
    document_name: input.documentName,
    file_path: input.filePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    expiry_date: input.expiryDate,
    notes: input.notes,
    upload_date: input.uploadDate,
  };

  const sets = [];
  const values = [];
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) {
      values.push(val === "" ? null : val);
      sets.push(`${col} = $${values.length}`);
    }
  }
  if (!sets.length) {
    throw new ApiError(400, "No updatable fields provided");
  }

  values.push(documentId, propertyId);
  const result = await pool.query(
    `UPDATE property_documents
     SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${values.length - 1}
       AND property_id = $${values.length}
       AND deleted_at IS NULL
     RETURNING *`,
    values
  );

  const publicDoc = toPublicDocument(result.rows[0]);
  await writeAudit(
    pool,
    adminId,
    "PROPERTY_DOCUMENT_UPDATE",
    "property_documents",
    documentId,
    toPublicDocument(prev),
    publicDoc
  );
  return publicDoc;
}

async function softDeleteDocument(propertyId, documentId, adminId) {
  await assertProperty(propertyId);

  const result = await pool.query(
    `UPDATE property_documents
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND property_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [adminId, documentId, propertyId]
  );
  if (!result.rows[0]) throw new ApiError(404, "Document not found");

  const row = result.rows[0];
  await writeAudit(
    pool,
    adminId,
    "PROPERTY_DOCUMENT_SOFT_DELETE",
    "property_documents",
    documentId,
    { deletedAt: null },
    { deletedAt: row.deleted_at }
  );

  return {
    id: Number(row.id),
    propertyId: Number(row.property_id),
    deletedAt: row.deleted_at,
  };
}

/* ------------------------------ Media ------------------------------ */

async function listMedia(propertyId, query = {}) {
  await assertProperty(propertyId);
  const { mediaType } = query;
  const where = ["pm.property_id = $1", "pm.deleted_at IS NULL"];
  const params = [propertyId];

  if (mediaType) {
    params.push(String(mediaType).toLowerCase());
    where.push(`pm.media_type = $${params.length}`);
  }

  const result = await pool.query(
    `SELECT pm.*, a.full_name AS uploaded_by_name
     FROM property_media pm
     LEFT JOIN admins a ON a.id = pm.uploaded_by
     WHERE ${where.join(" AND ")}
     ORDER BY pm.is_cover DESC, pm.sort_order ASC, pm.id DESC`,
    params
  );

  return {
    propertyId: Number(propertyId),
    items: result.rows.map(toPublicMedia),
  };
}

async function getMedia(propertyId, mediaId) {
  await assertProperty(propertyId);
  const result = await pool.query(
    `SELECT pm.*, a.full_name AS uploaded_by_name
     FROM property_media pm
     LEFT JOIN admins a ON a.id = pm.uploaded_by
     WHERE pm.id = $1 AND pm.property_id = $2 AND pm.deleted_at IS NULL
     LIMIT 1`,
    [mediaId, propertyId]
  );
  if (!result.rows[0]) throw new ApiError(404, "Media item not found");
  return toPublicMedia(result.rows[0]);
}

async function clearOtherCovers(client, propertyId, exceptId = null) {
  if (exceptId) {
    await client.query(
      `UPDATE property_media
       SET is_cover = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE property_id = $1 AND deleted_at IS NULL AND id <> $2 AND is_cover = TRUE`,
      [propertyId, exceptId]
    );
  } else {
    await client.query(
      `UPDATE property_media
       SET is_cover = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE property_id = $1 AND deleted_at IS NULL AND is_cover = TRUE`,
      [propertyId]
    );
  }
}

async function createMedia(propertyId, input, adminId) {
  await assertProperty(propertyId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const isCover = Boolean(input.isCover);
    if (isCover) {
      await clearOtherCovers(client, propertyId);
    }

    const insert = await client.query(
      `INSERT INTO property_media
         (property_id, media_type, file_path, file_name, mime_type,
          caption, sort_order, is_cover, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        propertyId,
        input.mediaType,
        input.filePath,
        input.fileName || null,
        input.mimeType || null,
        input.caption || null,
        input.sortOrder !== undefined ? input.sortOrder : 0,
        isCover,
        adminId,
      ]
    );

    const row = insert.rows[0];
    const publicMedia = toPublicMedia(row);

    await writeHistory(
      client,
      propertyId,
      "media_upload",
      `Media registered: ${row.media_type}`,
      adminId,
      {
        mediaId: Number(row.id),
        mediaType: row.media_type,
        filePath: row.file_path,
        fileName: row.file_name,
        isCover: row.is_cover,
      }
    );

    await writeAudit(
      client,
      adminId,
      "PROPERTY_MEDIA_CREATE",
      "property_media",
      row.id,
      null,
      publicMedia
    );

    await client.query("COMMIT");
    return publicMedia;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function updateMedia(propertyId, mediaId, input, adminId) {
  await assertProperty(propertyId);

  const existing = await pool.query(
    `SELECT * FROM property_media
     WHERE id = $1 AND property_id = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [mediaId, propertyId]
  );
  if (!existing.rows[0]) throw new ApiError(404, "Media item not found");
  const prev = existing.rows[0];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (input.isCover === true) {
      await clearOtherCovers(client, propertyId, mediaId);
    }

    const fields = {
      media_type: input.mediaType,
      file_path: input.filePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      caption: input.caption,
      sort_order: input.sortOrder,
      is_cover: input.isCover,
    };

    const sets = [];
    const values = [];
    for (const [col, val] of Object.entries(fields)) {
      if (val !== undefined) {
        values.push(val === "" ? null : val);
        sets.push(`${col} = $${values.length}`);
      }
    }
    if (!sets.length) {
      throw new ApiError(400, "No updatable fields provided");
    }

    values.push(mediaId, propertyId);
    const result = await client.query(
      `UPDATE property_media
       SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length - 1}
         AND property_id = $${values.length}
         AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    const publicMedia = toPublicMedia(result.rows[0]);
    await writeAudit(
      client,
      adminId,
      "PROPERTY_MEDIA_UPDATE",
      "property_media",
      mediaId,
      toPublicMedia(prev),
      publicMedia
    );

    await client.query("COMMIT");
    return publicMedia;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function softDeleteMedia(propertyId, mediaId, adminId) {
  await assertProperty(propertyId);

  const result = await pool.query(
    `UPDATE property_media
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND property_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [adminId, mediaId, propertyId]
  );
  if (!result.rows[0]) throw new ApiError(404, "Media item not found");

  const row = result.rows[0];
  await writeAudit(
    pool,
    adminId,
    "PROPERTY_MEDIA_SOFT_DELETE",
    "property_media",
    mediaId,
    { deletedAt: null },
    { deletedAt: row.deleted_at }
  );

  return {
    id: Number(row.id),
    propertyId: Number(row.property_id),
    deletedAt: row.deleted_at,
  };
}

module.exports = {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  softDeleteDocument,
  listMedia,
  getMedia,
  createMedia,
  updateMedia,
  softDeleteMedia,
};
