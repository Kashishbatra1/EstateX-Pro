import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getClient,
  deleteClient,
  updateClientNotes,
  updateClientFollowUp,
  addClientCommunication,
  addClientKycDocument,
  uploadClientKycDocument,
  deleteClientKycDocument,
} from "../../api/clients.js";
import { ApiError, resolveFileUrl } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import FavoriteToggle from "../../components/FavoriteToggle.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  COMMUNICATION_TYPES,
  formatLabel,
  formatBudget,
} from "../../utils/clientHelpers.js";
import "../../styles/properties.css";

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>
        {value === null || value === undefined || value === "" ? "—" : value}
      </dd>
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const [notesDraft, setNotesDraft] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState("");

  const [commType, setCommType] = useState("note");
  const [commSubject, setCommSubject] = useState("");
  const [commNotes, setCommNotes] = useState("");

  const [kycType, setKycType] = useState("");
  const [kycPath, setKycPath] = useState("");
  const [kycFileName, setKycFileName] = useState("");
  const [kycExpiry, setKycExpiry] = useState("");
  const [kycFile, setKycFile] = useState(null);
  const [kycDeleteId, setKycDeleteId] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getClient(id);
      setClient(data);
      setNotesDraft(data?.crmNotes || "");
      setFollowUpDraft(
        data?.nextFollowUpDate
          ? String(data.nextFollowUpDate).slice(0, 10)
          : ""
      );
    } catch (err) {
      setClient(null);
      setError(err instanceof ApiError ? err.message : "Failed to load client");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(""), 3200);
    return () => clearTimeout(t);
  }, [flash]);

  async function saveNotes() {
    setBusy(true);
    setActionError("");
    try {
      const updated = await updateClientNotes(id, notesDraft);
      setClient({
        ...client,
        ...updated,
        communications: client.communications,
        kycDocuments: client.kycDocuments,
      });
      setFlash("CRM notes saved");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save notes");
    } finally {
      setBusy(false);
    }
  }

  async function saveFollowUp() {
    setBusy(true);
    setActionError("");
    try {
      const updated = await updateClientFollowUp(
        id,
        followUpDraft.trim() === "" ? null : followUpDraft
      );
      setClient({
        ...client,
        ...updated,
        communications: client.communications,
        kycDocuments: client.kycDocuments,
      });
      setFlash("Follow-up date updated");
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to update follow-up"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAddCommunication(event) {
    event.preventDefault();
    if (!commNotes.trim() && !commSubject.trim()) {
      setActionError("Enter a subject or notes for the communication");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await addClientCommunication(id, {
        communicationType: commType,
        subject: commSubject.trim() || null,
        notes: commNotes.trim() || null,
      });
      setCommSubject("");
      setCommNotes("");
      setFlash("Communication logged");
      await load();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to add communication"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAddKyc(event) {
    event.preventDefault();
    if (!kycType.trim()) {
      setActionError("Document type is required");
      return;
    }
    if (!kycFile && !kycPath.trim()) {
      setActionError("Choose a file to upload, or enter a path/URL");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      if (kycFile) {
        const fd = new FormData();
        fd.append("file", kycFile);
        fd.append("documentType", kycType.trim());
        if (kycExpiry.trim()) fd.append("expiryDate", kycExpiry.trim());
        await uploadClientKycDocument(id, fd);
        setFlash("KYC document uploaded");
      } else {
        await addClientKycDocument(id, {
          documentType: kycType.trim(),
          filePath: kycPath.trim(),
          fileName: kycFileName.trim() || null,
          expiryDate: kycExpiry.trim() || null,
        });
        setFlash("KYC document registered");
      }
      setKycType("");
      setKycPath("");
      setKycFileName("");
      setKycExpiry("");
      setKycFile(null);
      await load();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to save KYC document"
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmKycDelete() {
    if (!kycDeleteId) return;
    setBusy(true);
    setActionError("");
    try {
      await deleteClientKycDocument(id, kycDeleteId);
      setKycDeleteId(null);
      setFlash("KYC document archived");
      await load();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to archive KYC document"
      );
      setKycDeleteId(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteClient(id);
      navigate("/clients", {
        replace: true,
        state: { flash: "Client moved to recycle bin" },
      });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Archive failed");
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="state-panel">
        <div className="spinner" aria-hidden="true" />
        <p>Loading client…</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{error || "Client not found"}</p>
        <Link to="/clients" className="btn btn--ghost">
          Back to list
        </Link>
      </div>
    );
  }

  const communications = client.communications || [];
  const kycDocuments = client.kycDocuments || [];

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/clients" className="crumb">
              Clients
            </Link>
            <span aria-hidden="true"> / </span>
            #{client.id}
          </p>
          <h2 className="page-toolbar__title">{client.clientName}</h2>
          <div className="detail-meta">
            <StatusBadge status={client.clientType} />
            <span className="muted">
              {formatLabel(client.whatsappSmsPreference)} preference
            </span>
          </div>
        </div>
        <div className="toolbar-actions">
          <FavoriteToggle entityType="client" entityId={client.id} />
          <Link
            to={`/bookings/new?clientId=${client.id}`}
            className="btn btn--primary btn--inline"
          >
            New booking
          </Link>
          <Link to={`/bookings?clientId=${client.id}`} className="btn btn--ghost">
            Bookings
          </Link>
          <Link to={`/clients/${client.id}/edit`} className="btn btn--ghost">
            Edit
          </Link>
          <button
            type="button"
            className="btn btn--danger-outline"
            onClick={() => setDeleteOpen(true)}
          >
            Archive
          </button>
        </div>
      </div>

      {flash ? <div className="toast toast--success">{flash}</div> : null}
      {actionError ? (
        <div className="alert alert--error" role="alert">
          {actionError}
        </div>
      ) : null}

      <div className="detail-layout">
        <div className="detail-side" style={{ gap: "1rem", display: "grid" }}>
          <section className="detail-card">
            <h3 className="detail-card__title">Basic information</h3>
            <dl className="detail-list">
              <DetailRow label="Phone" value={client.phone} />
              <DetailRow label="Email" value={client.email} />
              <DetailRow label="CNIC" value={client.cnic} />
              <DetailRow label="Address" value={client.address} />
              <DetailRow
                label="Budget"
                value={formatBudget(
                  client.budgetMin,
                  client.budgetMax,
                  formatMoney
                )}
              />
              <DetailRow
                label="Preferred type"
                value={client.preferredPropertyType}
              />
              <DetailRow
                label="Preferred location"
                value={client.preferredLocation}
              />
              <DetailRow
                label="Investment"
                value={client.investmentPreference}
              />
              <DetailRow label="Lead source" value={client.leadSource} />
              <DetailRow label="Referral" value={client.referralSource} />
              <DetailRow label="Rating" value={client.clientRating} />
              <DetailRow
                label="Created"
                value={
                  client.createdAt
                    ? new Date(client.createdAt).toLocaleString()
                    : null
                }
              />
            </dl>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Follow-up</h3>
            <div className="status-form">
              <input
                type="date"
                value={followUpDraft}
                onChange={(e) => setFollowUpDraft(e.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                className="btn btn--primary btn--inline"
                disabled={busy}
                onClick={saveFollowUp}
              >
                Save follow-up
              </button>
            </div>
            <p className="form-hint">Clear the date and save to remove follow-up.</p>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">CRM notes</h3>
            <textarea
              rows={5}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              disabled={busy}
            />
            <div className="form-actions" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="btn btn--primary btn--inline"
                disabled={busy}
                onClick={saveNotes}
              >
                Save notes
              </button>
            </div>
          </section>
        </div>

        <div className="detail-side">
          <section className="detail-card">
            <h3 className="detail-card__title">Communication history</h3>
            {communications.length === 0 ? (
              <p className="muted">No communications logged yet.</p>
            ) : (
              <ul className="simple-list">
                {communications.map((c) => (
                  <li key={c.id}>
                    <strong>{formatLabel(c.communicationType)}</strong>
                    {c.subject ? <span> — {c.subject}</span> : null}
                    <div className="muted tiny">
                      {c.communicatedAt
                        ? new Date(c.communicatedAt).toLocaleString()
                        : "—"}
                    </div>
                    {c.notes ? <p className="comm-notes">{c.notes}</p> : null}
                  </li>
                ))}
              </ul>
            )}

            <form className="inline-link-form" onSubmit={handleAddCommunication}>
              <select
                value={commType}
                onChange={(e) => setCommType(e.target.value)}
                disabled={busy}
              >
                {COMMUNICATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {formatLabel(t)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Subject (optional)"
                value={commSubject}
                onChange={(e) => setCommSubject(e.target.value)}
                disabled={busy}
              />
              <textarea
                rows={3}
                placeholder="Notes"
                value={commNotes}
                onChange={(e) => setCommNotes(e.target.value)}
                disabled={busy}
              />
              <button
                type="submit"
                className="btn btn--primary btn--inline"
                disabled={busy}
              >
                Log communication
              </button>
            </form>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">KYC documents</h3>
            <p className="form-hint">
              Upload supporting documents (PDF, Word, images) or register an
              existing path/URL. Uses approved KYC metadata fields.
            </p>
            {kycDocuments.length === 0 ? (
              <p className="muted">No KYC documents registered.</p>
            ) : (
              <ul className="simple-list">
                {kycDocuments.map((doc) => {
                  const href = resolveFileUrl(doc.filePath);
                  return (
                    <li key={doc.id} className="link-row">
                      <div>
                        <strong>{doc.documentType}</strong>
                        <div className="muted tiny">
                          {doc.fileName || doc.filePath}
                          {doc.expiryDate
                            ? ` · expires ${String(doc.expiryDate).slice(0, 10)}`
                            : ""}
                        </div>
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
                        onClick={() => setKycDeleteId(doc.id)}
                      >
                        Archive
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <form className="inline-link-form" onSubmit={handleAddKyc}>
              <input
                type="text"
                placeholder="Document type *"
                value={kycType}
                onChange={(e) => setKycType(e.target.value)}
                disabled={busy}
              />
              <label className="upload-field">
                <span className="muted tiny">Upload file</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setKycFile(f);
                    if (f) {
                      setKycPath("");
                      setKycFileName(f.name);
                    }
                  }}
                />
                {kycFile ? (
                  <span className="muted tiny">Selected: {kycFile.name}</span>
                ) : null}
              </label>
              <input
                type="text"
                placeholder="Or file path / URL"
                value={kycPath}
                onChange={(e) => {
                  setKycPath(e.target.value);
                  if (e.target.value) setKycFile(null);
                }}
                disabled={busy || Boolean(kycFile)}
              />
              {!kycFile ? (
                <input
                  type="text"
                  placeholder="File name (optional)"
                  value={kycFileName}
                  onChange={(e) => setKycFileName(e.target.value)}
                  disabled={busy}
                />
              ) : null}
              <input
                type="date"
                value={kycExpiry}
                onChange={(e) => setKycExpiry(e.target.value)}
                disabled={busy}
                aria-label="Expiry date"
              />
              <button
                type="submit"
                className="btn btn--primary btn--inline"
                disabled={busy}
              >
                {busy && kycFile
                  ? "Uploading…"
                  : kycFile
                    ? "Upload document"
                    : "Register document"}
              </button>
            </form>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Archive client?"
        message={`"${client.clientName}" will be soft-deleted. This is blocked if active bookings exist.`}
        confirmLabel="Archive"
        danger
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={Boolean(kycDeleteId)}
        title="Archive KYC document?"
        message="This soft-deletes the document metadata record. It does not delete any external files."
        confirmLabel="Archive"
        danger
        loading={busy}
        onCancel={() => setKycDeleteId(null)}
        onConfirm={confirmKycDelete}
      />
    </div>
  );
}
