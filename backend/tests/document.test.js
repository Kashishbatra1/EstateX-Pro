/**
 * Phase 25 — Documents & Media tests against live estatex_pro.
 * Usage: npm run test:documents
 */
const http = require("http");
const pool = require("../config/db");
const app = require("../app");
const { hashPassword } = require("../utils/password");

const stamp = Date.now();
const TEST_EMAIL = `documents.phase25.${stamp}@estatex.test`;
const TEST_PASSWORD = `Doc!${String(stamp).slice(-6)}`;

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
  let propertyId = null;
  let documentId = null;
  let mediaId = null;
  let mediaId2 = null;
  let token = null;

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
    ["Phase 25 Documents Tester", TEST_EMAIL, passwordHash]
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

    const unauth = await request(port, {
      path: "/api/properties/1/documents",
    });
    assert("Unauthorized documents returns 401", unauth.status === 401);

    const createProp = await request(port, {
      method: "POST",
      path: "/api/properties",
      token,
      body: {
        title: `Phase25 Docs House ${stamp}`,
        propertyType: "House",
        purpose: "sale",
        category: "residential",
        city: "Lahore",
        askingPrice: 9000000,
      },
    });
    assert("Create property returns 201", createProp.status === 201);
    propertyId = createProp.json?.data?.property?.id;
    assert("Property id present", Boolean(propertyId));

    const missingDoc = await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/documents`,
      token,
      body: { documentType: "registry" },
    });
    assert(
      "Document without filePath blocked",
      missingDoc.status === 400
    );

    const badType = await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/documents`,
      token,
      body: {
        documentType: "passport",
        filePath: `/uploads/docs/${stamp}.pdf`,
      },
    });
    assert("Invalid document type rejected", badType.status === 400);

    const addDoc = await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/documents`,
      token,
      body: {
        documentType: "registry",
        documentName: "Title Registry",
        filePath: `/uploads/docs/registry-${stamp}.pdf`,
        fileName: `registry-${stamp}.pdf`,
        mimeType: "application/pdf",
        notes: "Phase 25 test registry",
      },
    });
    assert("Register document returns 201", addDoc.status === 201);
    documentId = addDoc.json?.data?.document?.id;
    assert("Document id present", Boolean(documentId));
    assert(
      "Document type is registry",
      addDoc.json?.data?.document?.documentType === "registry"
    );

    const leaseDoc = await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/documents`,
      token,
      body: {
        documentType: "lease_certificate",
        filePath: `/uploads/docs/lease-${stamp}.pdf`,
        fileName: `lease-${stamp}.pdf`,
      },
    });
    assert("Lease certificate register returns 201", leaseDoc.status === 201);

    const listDocs = await request(port, {
      path: `/api/properties/${propertyId}/documents`,
      token,
    });
    assert("List documents returns 200", listDocs.status === 200);
    assert(
      "List includes at least 2 documents",
      (listDocs.json?.data?.items || []).length >= 2
    );

    const getDoc = await request(port, {
      path: `/api/properties/${propertyId}/documents/${documentId}`,
      token,
    });
    assert("Get document returns 200", getDoc.status === 200);

    const updateDoc = await request(port, {
      method: "PUT",
      path: `/api/properties/${propertyId}/documents/${documentId}`,
      token,
      body: { notes: "Updated notes", expiryDate: "2030-12-31" },
    });
    assert("Update document returns 200", updateDoc.status === 200);
    assert(
      "Notes updated",
      updateDoc.json?.data?.document?.notes === "Updated notes"
    );

    const histDoc = await request(port, {
      path: `/api/properties/${propertyId}/history?eventType=document_upload`,
      token,
    });
    assert(
      "document_upload history present",
      (histDoc.json?.data?.items || []).some(
        (e) => e.eventType === "document_upload"
      )
    );

    const missingMedia = await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/media`,
      token,
      body: { mediaType: "image" },
    });
    assert("Media without filePath blocked", missingMedia.status === 400);

    const addMedia = await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/media`,
      token,
      body: {
        mediaType: "image",
        filePath: `/uploads/media/cover-${stamp}.jpg`,
        fileName: `cover-${stamp}.jpg`,
        mimeType: "image/jpeg",
        caption: "Front elevation",
        isCover: true,
        sortOrder: 1,
      },
    });
    assert("Register media returns 201", addMedia.status === 201);
    mediaId = addMedia.json?.data?.media?.id;
    assert("Media is cover", addMedia.json?.data?.media?.isCover === true);

    const addFloor = await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/media`,
      token,
      body: {
        mediaType: "floor_plan",
        filePath: `/uploads/media/plan-${stamp}.png`,
        isCover: true,
      },
    });
    assert("Floor plan register returns 201", addFloor.status === 201);
    mediaId2 = addFloor.json?.data?.media?.id;
    assert("New cover is set", addFloor.json?.data?.media?.isCover === true);

    const listMedia = await request(port, {
      path: `/api/properties/${propertyId}/media`,
      token,
    });
    assert("List media returns 200", listMedia.status === 200);
    const mediaItems = listMedia.json?.data?.items || [];
    assert("Media list has 2 items", mediaItems.length === 2);
    const covers = mediaItems.filter((m) => m.isCover);
    assert("Only one cover active", covers.length === 1);
    assert("Cover is newer floor plan", covers[0]?.id === mediaId2);

    const video = await request(port, {
      method: "POST",
      path: `/api/properties/${propertyId}/media`,
      token,
      body: {
        mediaType: "video",
        filePath: `https://example.com/walkthrough-${stamp}.mp4`,
        caption: "Walkthrough",
      },
    });
    assert("Video register returns 201", video.status === 201);

    const histMedia = await request(port, {
      path: `/api/properties/${propertyId}/history?eventType=media_upload`,
      token,
    });
    assert(
      "media_upload history present",
      (histMedia.json?.data?.items || []).length >= 2
    );

    const delDoc = await request(port, {
      method: "DELETE",
      path: `/api/properties/${propertyId}/documents/${documentId}`,
      token,
    });
    assert("Soft-delete document returns 200", delDoc.status === 200);
    assert("Document deletedAt set", Boolean(delDoc.json?.data?.document?.deletedAt));

    const afterDelDoc = await request(port, {
      path: `/api/properties/${propertyId}/documents/${documentId}`,
      token,
    });
    assert("Soft-deleted document hidden", afterDelDoc.status === 404);

    const delMedia = await request(port, {
      method: "DELETE",
      path: `/api/properties/${propertyId}/media/${mediaId}`,
      token,
    });
    assert("Soft-delete media returns 200", delMedia.status === 200);

    const audit = await pool.query(
      `SELECT action FROM audit_logs
       WHERE admin_id = $1
         AND action IN (
           'PROPERTY_DOCUMENT_CREATE',
           'PROPERTY_MEDIA_CREATE',
           'PROPERTY_DOCUMENT_SOFT_DELETE'
         )`,
      [adminId]
    );
    const actions = audit.rows.map((r) => r.action);
    assert("Audit has document create", actions.includes("PROPERTY_DOCUMENT_CREATE"));
    assert("Audit has media create", actions.includes("PROPERTY_MEDIA_CREATE"));
    assert(
      "Audit has document soft-delete",
      actions.includes("PROPERTY_DOCUMENT_SOFT_DELETE")
    );

    const histOk = await request(port, {
      path: `/api/properties/${propertyId}/history`,
      token,
    });
    assert("History regression ok", histOk.status === 200);

    const propsOk = await request(port, {
      path: "/api/properties?limit=1",
      token,
    });
    assert("Properties regression ok", propsOk.status === 200);
  } catch (err) {
    assert(`Unexpected error: ${err.message}`, false);
  } finally {
    server.close();
    if (propertyId) {
      await pool.query(`DELETE FROM property_documents WHERE property_id = $1`, [
        propertyId,
      ]);
      await pool.query(`DELETE FROM property_media WHERE property_id = $1`, [
        propertyId,
      ]);
      await pool.query(`DELETE FROM property_history WHERE property_id = $1`, [
        propertyId,
      ]);
      await pool.query(`DELETE FROM properties WHERE id = $1`, [propertyId]);
    }
    if (adminId) {
      await pool.query(`DELETE FROM audit_logs WHERE admin_id = $1`, [adminId]);
      await pool.query(`DELETE FROM admins WHERE id = $1`, [adminId]);
    }
    await pool.end();
  }

  console.log(`\nPhase 25 documents tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
