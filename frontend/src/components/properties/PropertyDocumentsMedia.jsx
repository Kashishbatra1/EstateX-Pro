import { useCallback, useEffect, useState } from "react";
import {
  listPropertyDocuments,
  createPropertyDocument,
  uploadPropertyDocument,
  deletePropertyDocument,
  listPropertyMedia,
  createPropertyMedia,
  uploadPropertyMedia,
  updatePropertyMedia,
  deletePropertyMedia,
} from "../../api/properties.js";
import { ApiError, resolveFileUrl } from "../../api/client.js";
import ConfirmDialog from "../ConfirmDialog.jsx";
import { formatLabel } from "../../utils/propertyHelpers.js";

const DOCUMENT_TYPES = [
  { value: "registry", label: "Registry" },
  { value: "agreement", label: "Agreement" },
  { value: "tax_file", label: "Tax file" },
  { value: "lease_certificate", label: "Lease certificate" },
  { value: "other", label: "Other" },
];

const MEDIA_TYPES = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "floor_plan", label: "Floor plan" },
];

const emptyDoc = {
  documentType: "registry",
  documentName: "",
  filePath: "",
  fileName: "",
  mimeType: "",
  expiryDate: "",
  notes: "",
};

const emptyMedia = {
  mediaType: "image",
  filePath: "",
  fileName: "",
  mimeType: "",
  caption: "",
  sortOrder: "0",
  isCover: false,
};

function isImageMime(mime, filePath) {
  if (mime && String(mime).startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(filePath || "");
}

function MediaLocalPreview({ file }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!file) {
      setSrc("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!src) return null;
  return (
    <img className="docs-thumb docs-thumb--preview" src={src} alt="Selected preview" />
  );
}

export default function PropertyDocumentsMedia({ propertyId }) {
  const [documents, setDocuments] = useState([]);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [docForm, setDocForm] = useState(emptyDoc);
  const [mediaForm, setMediaForm] = useState(emptyMedia);
  const [docFile, setDocFile] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [docError, setDocError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [deleteMediaId, setDeleteMediaId] = useState(null);

  const load = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    setError("");
    try {
      const [docs, mediaItems] = await Promise.all([
        listPropertyDocuments(propertyId),
        listPropertyMedia(propertyId),
      ]);
      setDocuments(docs);
      setMedia(mediaItems);
    } catch (err) {
      setDocuments([]);
      setMedia([]);
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load documents and media"
      );
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(""), 2800);
    return () => clearTimeout(t);
  }, [flash]);

  async function handleAddDocument(e) {
    e.preventDefault();
    setDocError("");
    if (!docFile && !docForm.filePath.trim()) {
      setDocError("Choose a file to upload, or enter a path/URL.");
      return;
    }
    setBusy(true);
    try {
      if (docFile) {
        const fd = new FormData();
        fd.append("file", docFile);
        fd.append("documentType", docForm.documentType);
        if (docForm.documentName.trim()) {
          fd.append("documentName", docForm.documentName.trim());
        }
        if (docForm.expiryDate) fd.append("expiryDate", docForm.expiryDate);
        if (docForm.notes.trim()) fd.append("notes", docForm.notes.trim());
        await uploadPropertyDocument(propertyId, fd);
        setFlash("Document uploaded");
      } else {
        await createPropertyDocument(propertyId, {
          documentType: docForm.documentType,
          documentName: docForm.documentName.trim() || null,
          filePath: docForm.filePath.trim(),
          fileName: docForm.fileName.trim() || null,
          mimeType: docForm.mimeType.trim() || null,
          expiryDate: docForm.expiryDate || null,
          notes: docForm.notes.trim() || null,
        });
        setFlash("Document registered");
      }
      setDocForm(emptyDoc);
      setDocFile(null);
      await load();
    } catch (err) {
      setDocError(
        err instanceof ApiError ? err.message : "Failed to save document"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMedia(e) {
    e.preventDefault();
    setMediaError("");
    const isVideo = mediaForm.mediaType === "video";
    if (!isVideo && mediaFile) {
      // binary upload path
    } else if (!mediaForm.filePath.trim() && !(mediaFile && !isVideo)) {
      setMediaError(
        isVideo
          ? "Video path or URL is required (binary video upload is not supported)."
          : "Choose an image file to upload, or enter a path/URL."
      );
      return;
    }
    setBusy(true);
    try {
      if (mediaFile && !isVideo) {
        const fd = new FormData();
        fd.append("file", mediaFile);
        fd.append("mediaType", mediaForm.mediaType);
        if (mediaForm.caption.trim()) {
          fd.append("caption", mediaForm.caption.trim());
        }
        fd.append("sortOrder", String(Number(mediaForm.sortOrder) || 0));
        if (mediaForm.isCover) fd.append("isCover", "true");
        await uploadPropertyMedia(propertyId, fd);
        setFlash("Media uploaded");
      } else {
        await createPropertyMedia(propertyId, {
          mediaType: mediaForm.mediaType,
          filePath: mediaForm.filePath.trim(),
          fileName: mediaForm.fileName.trim() || null,
          mimeType: mediaForm.mimeType.trim() || null,
          caption: mediaForm.caption.trim() || null,
          sortOrder: Number(mediaForm.sortOrder) || 0,
          isCover: Boolean(mediaForm.isCover),
        });
        setFlash("Media registered");
      }
      setMediaForm(emptyMedia);
      setMediaFile(null);
      await load();
    } catch (err) {
      setMediaError(
        err instanceof ApiError ? err.message : "Failed to save media"
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteDoc() {
    if (!deleteDocId) return;
    setBusy(true);
    try {
      await deletePropertyDocument(propertyId, deleteDocId);
      setDeleteDocId(null);
      setFlash("Document archived");
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to archive document"
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteMedia() {
    if (!deleteMediaId) return;
    setBusy(true);
    try {
      await deletePropertyMedia(propertyId, deleteMediaId);
      setDeleteMediaId(null);
      setFlash("Media archived");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to archive media");
    } finally {
      setBusy(false);
    }
  }

  async function setAsCover(mediaId) {
    setBusy(true);
    setError("");
    try {
      await updatePropertyMedia(propertyId, mediaId, { isCover: true });
      setFlash("Cover image updated");
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to update cover"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="detail-card">
        <h3 className="detail-card__title">Documents</h3>
        <p className="form-hint">
          Upload PDF, Word, or image files, or register an existing path/URL.
          Metadata uses the approved document fields.
        </p>

        {flash ? (
          <div className="alert alert--success" role="status">
            {flash}
          </div>
        ) : null}
        {error ? (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        ) : null}
        {loading ? <p className="muted">Loading documents &amp; media…</p> : null}

        {!loading && documents.length === 0 ? (
          <p className="muted">No documents registered yet.</p>
        ) : null}

        {!loading && documents.length > 0 ? (
          <ul className="docs-list">
            {documents.map((doc) => {
              const href = resolveFileUrl(doc.filePath);
              return (
                <li key={doc.id} className="docs-list__item">
                  <div className="docs-list__main">
                    <span className="docs-file-icon" aria-hidden>
                      Doc
                    </span>
                    <div>
                      <strong>{formatLabel(doc.documentType)}</strong>
                      {doc.documentName ? ` — ${doc.documentName}` : ""}
                      <div className="muted tiny">
                        {doc.fileName || doc.filePath}
                        {doc.expiryDate
                          ? ` · expires ${String(doc.expiryDate).slice(0, 10)}`
                          : ""}
                      </div>
                      {doc.notes ? (
                        <div className="muted tiny">{doc.notes}</div>
                      ) : null}
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
                  </div>
                  <button
                    type="button"
                    className="btn btn--tiny btn--danger-text"
                    disabled={busy}
                    onClick={() => setDeleteDocId(doc.id)}
                  >
                    Archive
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <form className="docs-form" onSubmit={handleAddDocument}>
          {docError ? (
            <div className="alert alert--error" role="alert">
              {docError}
            </div>
          ) : null}
          <div className="form-grid">
            <label>
              Type *
              <select
                value={docForm.documentType}
                onChange={(e) =>
                  setDocForm((f) => ({ ...f, documentType: e.target.value }))
                }
                disabled={busy}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Document name
              <input
                type="text"
                value={docForm.documentName}
                onChange={(e) =>
                  setDocForm((f) => ({ ...f, documentName: e.target.value }))
                }
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
                  if (f) {
                    setDocForm((prev) => ({
                      ...prev,
                      filePath: "",
                      fileName: f.name,
                      mimeType: f.type || "",
                    }));
                  }
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
                value={docForm.filePath}
                onChange={(e) => {
                  setDocForm((f) => ({ ...f, filePath: e.target.value }));
                  if (e.target.value) setDocFile(null);
                }}
                disabled={busy || Boolean(docFile)}
                placeholder="/uploads/docs/registry.pdf"
              />
            </label>
            {!docFile ? (
              <>
                <label>
                  File name
                  <input
                    type="text"
                    value={docForm.fileName}
                    onChange={(e) =>
                      setDocForm((f) => ({ ...f, fileName: e.target.value }))
                    }
                    disabled={busy}
                  />
                </label>
                <label>
                  Mime type
                  <input
                    type="text"
                    value={docForm.mimeType}
                    onChange={(e) =>
                      setDocForm((f) => ({ ...f, mimeType: e.target.value }))
                    }
                    disabled={busy}
                    placeholder="application/pdf"
                  />
                </label>
              </>
            ) : null}
            <label>
              Expiry date
              <input
                type="date"
                value={docForm.expiryDate}
                onChange={(e) =>
                  setDocForm((f) => ({ ...f, expiryDate: e.target.value }))
                }
                disabled={busy}
              />
            </label>
            <label className="form-grid__full">
              Notes
              <input
                type="text"
                value={docForm.notes}
                onChange={(e) =>
                  setDocForm((f) => ({ ...f, notes: e.target.value }))
                }
                disabled={busy}
              />
            </label>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn--primary btn--inline"
              disabled={busy}
            >
              {busy && docFile
                ? "Uploading…"
                : docFile
                  ? "Upload document"
                  : "Register document"}
            </button>
          </div>
        </form>
      </section>

      <section className="detail-card">
        <h3 className="detail-card__title">Media</h3>
        <p className="form-hint">
          Upload images or floor plans (JPG, PNG, WEBP). Videos remain
          path/URL registration only. One cover image per property.
        </p>

        {!loading && media.length === 0 ? (
          <p className="muted">No media registered yet.</p>
        ) : null}

        {!loading && media.length > 0 ? (
          <ul className="docs-list">
            {media.map((item) => {
              const href = resolveFileUrl(item.filePath);
              const showThumb = isImageMime(item.mimeType, item.filePath);
              return (
                <li key={item.id} className="docs-list__item">
                  <div className="docs-list__main">
                    {showThumb && href ? (
                      <img
                        className="docs-thumb"
                        src={href}
                        alt={item.caption || item.fileName || "Property media"}
                      />
                    ) : (
                      <span className="docs-file-icon" aria-hidden>
                        {item.mediaType === "video" ? "Vid" : "Img"}
                      </span>
                    )}
                    <div>
                      <strong>{formatLabel(item.mediaType)}</strong>
                      {item.isCover ? (
                        <span
                          className="pill-flag"
                          style={{ marginLeft: "0.4rem" }}
                        >
                          Cover
                        </span>
                      ) : null}
                      <div className="muted tiny">
                        {item.fileName || item.filePath}
                        {item.caption ? ` · ${item.caption}` : ""}
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
                  </div>
                  <div className="docs-list__actions">
                    {!item.isCover ? (
                      <button
                        type="button"
                        className="btn btn--tiny btn--ghost"
                        disabled={busy}
                        onClick={() => setAsCover(item.id)}
                      >
                        Set cover
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn--tiny btn--danger-text"
                      disabled={busy}
                      onClick={() => setDeleteMediaId(item.id)}
                    >
                      Archive
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        <form className="docs-form" onSubmit={handleAddMedia}>
          {mediaError ? (
            <div className="alert alert--error" role="alert">
              {mediaError}
            </div>
          ) : null}
          <div className="form-grid">
            <label>
              Type *
              <select
                value={mediaForm.mediaType}
                onChange={(e) => {
                  const mediaType = e.target.value;
                  setMediaForm((f) => ({ ...f, mediaType }));
                  if (mediaType === "video") setMediaFile(null);
                }}
                disabled={busy}
              >
                {MEDIA_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort order
              <input
                type="number"
                value={mediaForm.sortOrder}
                onChange={(e) =>
                  setMediaForm((f) => ({ ...f, sortOrder: e.target.value }))
                }
                disabled={busy}
              />
            </label>
            {mediaForm.mediaType !== "video" ? (
              <label className="form-grid__full">
                Upload image
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setMediaFile(f);
                    if (f) {
                      setMediaForm((prev) => ({
                        ...prev,
                        filePath: "",
                        fileName: f.name,
                        mimeType: f.type || "",
                      }));
                    }
                  }}
                />
                {mediaFile ? (
                  <span className="muted tiny">Selected: {mediaFile.name}</span>
                ) : (
                  <span className="muted tiny">JPG, PNG, WEBP · max 8 MB</span>
                )}
                {mediaFile && mediaFile.type.startsWith("image/") ? (
                  <MediaLocalPreview file={mediaFile} />
                ) : null}
              </label>
            ) : null}
            <label className="form-grid__full">
              {mediaForm.mediaType === "video"
                ? "Video path or URL *"
                : "Or path / URL"}
              <input
                type="text"
                value={mediaForm.filePath}
                onChange={(e) => {
                  setMediaForm((f) => ({ ...f, filePath: e.target.value }));
                  if (e.target.value) setMediaFile(null);
                }}
                disabled={busy || Boolean(mediaFile)}
                placeholder={
                  mediaForm.mediaType === "video"
                    ? "https://… or /uploads/media/clip.mp4"
                    : "/uploads/media/photo.jpg"
                }
              />
            </label>
            {!mediaFile ? (
              <>
                <label>
                  File name
                  <input
                    type="text"
                    value={mediaForm.fileName}
                    onChange={(e) =>
                      setMediaForm((f) => ({ ...f, fileName: e.target.value }))
                    }
                    disabled={busy}
                  />
                </label>
                <label>
                  Mime type
                  <input
                    type="text"
                    value={mediaForm.mimeType}
                    onChange={(e) =>
                      setMediaForm((f) => ({ ...f, mimeType: e.target.value }))
                    }
                    disabled={busy}
                    placeholder="image/jpeg"
                  />
                </label>
              </>
            ) : null}
            <label className="form-grid__full">
              Caption
              <input
                type="text"
                value={mediaForm.caption}
                onChange={(e) =>
                  setMediaForm((f) => ({ ...f, caption: e.target.value }))
                }
                disabled={busy}
              />
            </label>
            <label className="docs-check">
              <input
                type="checkbox"
                checked={mediaForm.isCover}
                onChange={(e) =>
                  setMediaForm((f) => ({ ...f, isCover: e.target.checked }))
                }
                disabled={busy}
              />
              Set as cover
            </label>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn--primary btn--inline"
              disabled={busy}
            >
              {busy && mediaFile
                ? "Uploading…"
                : mediaFile
                  ? "Upload media"
                  : "Register media"}
            </button>
          </div>
        </form>
      </section>

      <ConfirmDialog
        open={Boolean(deleteDocId)}
        title="Archive document?"
        message="This soft-deletes the document metadata. External files are not deleted."
        confirmLabel="Archive"
        danger
        loading={busy}
        onCancel={() => setDeleteDocId(null)}
        onConfirm={confirmDeleteDoc}
      />

      <ConfirmDialog
        open={Boolean(deleteMediaId)}
        title="Archive media?"
        message="This soft-deletes the media metadata. External files are not deleted."
        confirmLabel="Archive"
        danger
        loading={busy}
        onCancel={() => setDeleteMediaId(null)}
        onConfirm={confirmDeleteMedia}
      />
    </>
  );
}
