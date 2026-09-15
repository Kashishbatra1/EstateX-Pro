/**
 * Global Search across properties, clients, owners, vendors, expenses.
 */
const pool = require("../config/db");
const ApiError = require("../utils/ApiError");

async function globalSearch(q) {
  const term = String(q || "").trim();
  if (term.length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters", [
      { field: "q", message: "Minimum 2 characters" },
    ]);
  }
  const like = `%${term}%`;

  const [properties, clients, owners, vendors, expenses] = await Promise.all([
    pool.query(
      `SELECT id, title AS label, property_code AS code
       FROM properties
       WHERE deleted_at IS NULL
         AND (title ILIKE $1 OR property_code ILIKE $1 OR COALESCE(city,'') ILIKE $1 OR COALESCE(area,'') ILIKE $1)
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 15`,
      [like]
    ),
    pool.query(
      `SELECT id, client_name AS label, phone AS code
       FROM clients
       WHERE deleted_at IS NULL
         AND (client_name ILIKE $1 OR COALESCE(phone,'') ILIKE $1 OR COALESCE(email,'') ILIKE $1)
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 15`,
      [like]
    ),
    pool.query(
      `SELECT id, owner_name AS label, cnic AS code
       FROM owners
       WHERE deleted_at IS NULL
         AND (owner_name ILIKE $1 OR COALESCE(phone,'') ILIKE $1 OR COALESCE(cnic,'') ILIKE $1)
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 15`,
      [like]
    ),
    pool.query(
      `SELECT id, vendor_name AS label, phone AS code
       FROM vendors
       WHERE deleted_at IS NULL
         AND (vendor_name ILIKE $1 OR COALESCE(contact_person,'') ILIKE $1 OR COALESCE(services,'') ILIKE $1)
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 15`,
      [like]
    ),
    pool.query(
      `SELECT id, expense_code AS label, description AS code
       FROM expenses
       WHERE deleted_at IS NULL
         AND (expense_code ILIKE $1 OR COALESCE(description,'') ILIKE $1 OR COALESCE(device_or_item_name,'') ILIKE $1)
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 15`,
      [like]
    ),
  ]);

  function mapRows(rows, type, pathPrefix) {
    return rows.map((r) => ({
      id: Number(r.id),
      type,
      label: r.label,
      code: r.code || null,
      path: `${pathPrefix}/${r.id}`,
    }));
  }

  return {
    q: term,
    properties: mapRows(properties.rows, "property", "/properties"),
    clients: mapRows(clients.rows, "client", "/clients"),
    owners: mapRows(owners.rows, "owner", "/owners"),
    vendors: mapRows(vendors.rows, "vendor", "/vendors"),
    expenses: mapRows(expenses.rows, "expense", "/expenses"),
  };
}

module.exports = { globalSearch };
