import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getVendor,
  deleteVendor,
  addVendorPayment,
  addVendorDocument,
  uploadVendorDocument,
  deleteVendorDocument,
} from "../../api/vendors.js";
import { ApiError, resolveFileUrl } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import FavoriteToggle from "../../components/FavoriteToggle.jsx";
import { formatMoney } from "../../utils/format.js";
import { formatApiError } from "../../utils/vendorHelpers.js";
import "../../styles/properties.css";

function Row({ label, value }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value == null || value === "" ? "—" : value}</dd>
    </div>
  );
}

export default function VendorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [busy, setBusy] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [docPath, setDocPath] = useState("");
  const [docName, setDocName] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [docDeleteId, setDocDeleteId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setVendor(await getVendor(id));
    } catch (err) {
      setVendor(null);
      setError(err instanceof ApiError ? formatApiError(err) : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePayment(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await addVendorPayment(id, {
        amount: Number(payAmount),
        notes: payNotes.trim() || null,
      });
      setPayAmount("");
      setPayNotes("");
      setFlash("Payment recorded");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDocument(e) {
    e.preventDefault();
    if (!docFile && !docPath.trim()) {
      setError("Choose a file to upload, or enter a path/URL");
      return;
    }
    setBusy(true);
    try {
      if (docFile) {
        const fd = new FormData();
        fd.append("file", docFile);
        if (docName.trim()) fd.append("documentName", docName.trim());
        await uploadVendorDocument(id, fd);
        setFlash("Document uploaded");
      } else {
        await addVendorDocument(id, {
          documentName: docName.trim() || null,
          filePath: docPath.trim(),
        });
        setFlash("Document registered");
      }
      setDocName("");
      setDocPath("");
      setDocFile(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err) : "Document failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading vendor…</p>;
  if (!vendor) {
    return (
      <div className="state-panel state-panel--error">
        {error || "Not found"}
        <Link to="/vendors">Back</Link>
      </div>
    );
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/vendors" className="crumb">
              Vendors
            </Link>
          </p>
          <h2 className="page-toolbar__title">{vendor.vendorName}</h2>
          {vendor.isPreferred ? <span className="pill-flag">Preferred</span> : null}
        </div>
        <div className="toolbar-actions">
          <FavoriteToggle entityType="vendor" entityId={vendor.id} />
          <Link
            to={`/expenses?vendorId=${vendor.id}`}
            className="btn btn--ghost"
          >
            Related expenses
          </Link>
          <Link to={`/expenses/new`} className="btn btn--ghost">
            Add expense
          </Link>
          <Link to={`/vendors/${id}/edit`} className="btn btn--ghost">
            Edit
          </Link>
          <button type="button" className="btn btn--danger-text" onClick={() => setDeleteOpen(true)}>
            Archive
          </button>
        </div>
      </div>

      {flash ? <div className="alert alert--success">{flash}</div> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      <div className="detail-layout">
        <div className="detail-stack">
          <section className="detail-card">
            <h3 className="detail-card__title">Details</h3>
            <dl className="detail-list detail-list--2">
              <Row label="Contact" value={vendor.contactPerson} />
              <Row label="Phone" value={vendor.phone} />
              <Row label="Email" value={vendor.email} />
              <Row label="Services" value={vendor.services} />
              <Row label="Payment terms" value={vendor.paymentTerms} />
              <Row
                label="Outstanding"
                value={formatMoney(vendor.outstandingBalance)}
              />
              <Row label="Contract start" value={vendor.contractStartDate} />
              <Row label="Contract end" value={vendor.contractEndDate} />
              <Row label="Address" value={vendor.address} />
              <Row label="Notes" value={vendor.notes} />
            </dl>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Payments</h3>
            {(vendor.payments || []).length === 0 ? (
              <p className="muted">No payments yet.</p>
            ) : (
              <ul className="docs-list">
                {vendor.payments.map((p) => (
                  <li key={p.id} className="docs-list__item">
                    <div>
                      <strong>{formatMoney(p.amount)}</strong>
                      <div className="muted tiny">
                        {p.paymentDate}
                        {p.notes ? ` · ${p.notes}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form className="docs-form" onSubmit={handlePayment}>
              <div className="form-grid">
                <label>
                  Amount *
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                    disabled={busy}
                  />
                </label>
                <label>
                  Notes
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    disabled={busy}
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn--primary btn--inline" disabled={busy}>
                  Record payment
                </button>
              </div>
            </form>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Documents / receipts</h3>
            <p className="form-hint">
              Upload PDF, Word, or image files, or register an existing path/URL.
            </p>
            {(vendor.documents || []).length === 0 ? (
              <p className="muted">No documents registered.</p>
            ) : (
              <ul className="docs-list">
                {vendor.documents.map((d) => {
                  const href = resolveFileUrl(d.filePath);
                  return (
                    <li key={d.id} className="docs-list__item">
                      <div>
                        <strong>{d.documentName || d.fileName || "Document"}</strong>
                        <div className="muted tiny">{d.fileName || d.filePath}</div>
                        {href ? (
                          <a
                            className="docs-open-link"
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open / view
                          </a>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="btn btn--tiny btn--danger-text"
                        disabled={busy}
                        onClick={() => setDocDeleteId(d.id)}
                      >
                        Archive
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <form className="docs-form" onSubmit={handleDocument}>
              <div className="form-grid">
                <label>
                  Name
                  <input
                    type="text"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="form-grid__full">
                  Upload file
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setDocFile(f);
                      if (f) setDocPath("");
                    }}
                  />
                  {docFile ? (
                    <span className="muted tiny">Selected: {docFile.name}</span>
                  ) : (
                    <span className="muted tiny">
                      PDF, DOC/DOCX, JPG, PNG, WEBP · max 10 MB
                    </span>
                  )}
                </label>
                <label className="form-grid__full">
                  Or path / URL
                  <input
                    type="text"
                    value={docPath}
                    onChange={(e) => {
                      setDocPath(e.target.value);
                      if (e.target.value) setDocFile(null);
                    }}
                    disabled={busy || Boolean(docFile)}
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn--primary btn--inline" disabled={busy}>
                  {busy && docFile
                    ? "Uploading…"
                    : docFile
                      ? "Upload document"
                      : "Register document"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Archive vendor?"
        message={`"${vendor.vendorName}" will be soft-deleted.`}
        confirmLabel="Archive"
        danger
        loading={busy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteVendor(id);
            navigate("/vendors", { state: { flash: "Vendor archived" } });
          } catch (err) {
            setError(err instanceof ApiError ? formatApiError(err) : "Archive failed");
            setDeleteOpen(false);
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(docDeleteId)}
        title="Archive document?"
        message="Soft-deletes document metadata only."
        confirmLabel="Archive"
        danger
        loading={busy}
        onCancel={() => setDocDeleteId(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteVendorDocument(id, docDeleteId);
            setDocDeleteId(null);
            setFlash("Document archived");
            await load();
          } catch (err) {
            setError(err instanceof ApiError ? formatApiError(err) : "Failed");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
