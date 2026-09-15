/**
 * Phase 6 — Client / CRM tests against live estatex_pro.
 * Usage: npm run test:clients
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `clients.phase6.${stamp}@estatex.test`;
const TEST_PASSWORD = `Cli!${String(stamp).slice(-6)}`;

function request(port, { method = "GET", path, body, token } = {}) {
  const payload = body ? JSON.stringify(body) : null;
  const headers = { Accept: "application/json" };
  if (payload) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(payload);
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path, method, headers },
      (res) => {
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, body: data, json });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  let passed = 0;
  let failed = 0;
  let adminId = null;
  let token = null;
  let clientId = null;
  let kycId = null;

  function assert(name, condition) {
    if (condition) {
      console.log(`PASS — ${name}`);
      passed += 1;
    } else {
      console.error(`FAIL — ${name}`);
      failed += 1;
    }
  }

  const passwordHash = await hashPassword(TEST_PASSWORD);
  const adminIns = await pool.query(
    `INSERT INTO admins (full_name, email, password_hash, is_active)
     VALUES ($1, $2, $3, TRUE) RETURNING id`,
    ["Phase 6 Client Tester", TEST_EMAIL, passwordHash]
  );
  adminId = adminIns.rows[0].id;

  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address();

  try {
    const login = await request(port, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    token = login.json?.data?.token;
    assert("Auth setup", Boolean(token));

    // 1) Unauthorized
    const unauth = await request(port, { path: "/api/clients" });
    assert("Unauthorized access returns 401", unauth.status === 401);

    // 2) Create client
    const create = await request(port, {
      method: "POST",
      path: "/api/clients",
      token,
      body: {
        clientName: `Phase6 Client ${stamp}`,
        cnic: `35202-${String(stamp).slice(-7)}-6`,
        phone: "03111222333",
        email: `client.${stamp}@test.com`,
        clientType: "buyer",
        budgetMin: 5000000,
        budgetMax: 15000000,
        investmentPreference: "Long-term hold",
        preferredPropertyType: "House",
        preferredLocation: "Lahore - DHA",
        leadSource: "Walk-in",
        referralSource: "Friend",
        crmNotes: "Initial CRM note",
        whatsappSmsPreference: "whatsapp",
        clientRating: 4.5,
        nextFollowUpDate: "2030-01-15",
      },
    });
    assert("Create client returns 201", create.status === 201);
    clientId = create.json?.data?.client?.id;
    assert("Created client has id", Boolean(clientId));
    assert("Client type is buyer", create.json?.data?.client?.clientType === "buyer");

    // 3) Get all
    const list = await request(port, { path: "/api/clients", token });
    assert("Get all clients returns 200", list.status === 200);
    assert("Get all returns items", Array.isArray(list.json?.data?.items));

    // 4) Get by id
    const byId = await request(port, { path: `/api/clients/${clientId}`, token });
    assert("Get client by id returns 200", byId.status === 200);
    assert(
      "Get by id includes communications array",
      Array.isArray(byId.json?.data?.client?.communications)
    );

    // 5) Update
    const update = await request(port, {
      method: "PUT",
      path: `/api/clients/${clientId}`,
      token,
      body: {
        preferredLocation: "Lahore - Johar Town",
        investmentPreference: "Rental income",
        clientType: "both",
      },
    });
    assert("Update client returns 200", update.status === 200);
    assert(
      "Update changes preferred location",
      update.json?.data?.client?.preferredLocation === "Lahore - Johar Town"
    );

    // 6) Invalid input
    const invalid = await request(port, {
      method: "POST",
      path: "/api/clients",
      token,
      body: { clientName: "", budgetMin: 10, budgetMax: 1 },
    });
    assert("Invalid input returns 400", invalid.status === 400);

    // 7) Search
    const search = await request(port, {
      path: `/api/clients?search=Phase6%20Client%20${stamp}`,
      token,
    });
    assert("Search client returns 200", search.status === 200);
    assert(
      "Search finds client",
      (search.json?.data?.items || []).some((c) => c.id === clientId)
    );

    // 8) Filter
    const filter = await request(port, {
      path: "/api/clients?clientType=both&preferredLocation=Johar&investmentPreference=Rental&preferredPropertyType=House&budgetMin=4000000&budgetMax=20000000",
      token,
    });
    assert("Filter clients returns 200", filter.status === 200);
    assert(
      "Filter includes test client",
      (filter.json?.data?.items || []).some((c) => c.id === clientId)
    );

    // 9) CRM notes + communication log
    const notes = await request(port, {
      method: "PATCH",
      path: `/api/clients/${clientId}/notes`,
      token,
      body: { crmNotes: "Updated CRM notes from Phase 6 test" },
    });
    assert("Update CRM notes returns 200", notes.status === 200);
    assert(
      "CRM notes updated",
      notes.json?.data?.client?.crmNotes.includes("Updated CRM notes")
    );

    const comm = await request(port, {
      method: "POST",
      path: `/api/clients/${clientId}/communications`,
      token,
      body: {
        communicationType: "call",
        subject: "Follow-up call",
        notes: "Discussed DHA preferences",
      },
    });
    assert("Add communication returns 201", comm.status === 201);

    const commList = await request(port, {
      path: `/api/clients/${clientId}/communications`,
      token,
    });
    assert("List communications returns 200", commList.status === 200);
    assert(
      "Communication log has entries",
      (commList.json?.data?.items || []).length >= 1
    );

    // KYC document metadata
    const kyc = await request(port, {
      method: "POST",
      path: `/api/clients/${clientId}/kyc-documents`,
      token,
      body: {
        documentType: "CNIC Front",
        filePath: `/uploads/kyc/phase6-${stamp}.pdf`,
        fileName: `phase6-${stamp}.pdf`,
        mimeType: "application/pdf",
        expiryDate: "2031-12-31",
      },
    });
    assert("Add KYC document returns 201", kyc.status === 201);
    kycId = kyc.json?.data?.document?.id;

    // 10) Follow-up date
    const followUp = await request(port, {
      method: "PATCH",
      path: `/api/clients/${clientId}/follow-up`,
      token,
      body: { nextFollowUpDate: "2030-06-01" },
    });
    assert("Update follow-up date returns 200", followUp.status === 200);
    assert(
      "Follow-up date updated",
      String(followUp.json?.data?.client?.nextFollowUpDate).startsWith("2030-06-01")
    );

    // 11) Soft delete / archive
    const del = await request(port, {
      method: "DELETE",
      path: `/api/clients/${clientId}`,
      token,
    });
    assert("Soft-delete client returns 200", del.status === 200);

    const afterDelete = await request(port, {
      path: `/api/clients/${clientId}`,
      token,
    });
    assert("Soft-deleted client not returned by get", afterDelete.status === 404);

    const listAfter = await request(port, {
      path: `/api/clients?search=Phase6%20Client%20${stamp}`,
      token,
    });
    assert(
      "Soft-deleted client excluded from list",
      !(listAfter.json?.data?.items || []).some((c) => c.id === clientId)
    );

    const inDb = await pool.query(
      `SELECT deleted_at IS NOT NULL AS archived FROM clients WHERE id = $1`,
      [clientId]
    );
    assert("Client remains archived in database", inDb.rows[0]?.archived === true);

    // 12) Existing modules still work (auth + properties health smoke)
    const health = await request(port, { path: "/api/health" });
    assert("Existing health endpoint still works", health.status === 200);

    const props = await request(port, { path: "/api/properties", token });
    assert("Existing properties module still works", props.status === 200);

    const owners = await request(port, { path: "/api/owners", token });
    assert("Existing owners module still works", owners.status === 200);

    const banks = await request(port, { path: "/api/bank-accounts", token });
    assert("Existing banks module still works", banks.status === 200);
  } catch (err) {
    assert(`Unexpected error: ${err.message}`, false);
  } finally {
    server.close();
    if (clientId) {
      await pool.query(`DELETE FROM client_communications WHERE client_id = $1`, [clientId]);
      await pool.query(`DELETE FROM client_kyc_documents WHERE client_id = $1`, [clientId]);
      await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
    }
    if (adminId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.end();
  }

  console.log("");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

run().catch(async (err) => {
  console.error("Client test runner failed:", err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
