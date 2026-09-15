import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getOwner,
  deleteOwner,
  updateOwnerVerification,
} from "../../api/owners.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import FavoriteToggle from "../../components/FavoriteToggle.jsx";
import {
  VERIFICATION_STATUSES,
  formatLabel,
} from "../../utils/ownerHelpers.js";
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

export default function OwnerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [actionError, setActionError] = useState("");
  const [verification, setVerification] = useState("");
  const [savingVerification, setSavingVerification] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getOwner(id);
      setOwner(data);
      setVerification(data?.verificationStatus || "unverified");
    } catch (err) {
      setOwner(null);
      setError(err instanceof ApiError ? err.message : "Failed to load owner");
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

  async function handleVerification() {
    if (!owner || verification === owner.verificationStatus) return;
    setActionError("");
    setSavingVerification(true);
    try {
      const updated = await updateOwnerVerification(id, verification);
      setOwner({ ...owner, ...updated, properties: owner.properties });
      setFlash(`Verification set to ${updated.verificationStatus}`);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Verification update failed"
      );
    } finally {
      setSavingVerification(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteOwner(id);
      navigate("/owners", {
        replace: true,
        state: { flash: "Owner moved to recycle bin" },
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
        <p>Loading owner…</p>
      </div>
    );
  }

  if (error || !owner) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{error || "Owner not found"}</p>
        <Link to="/owners" className="btn btn--ghost">
          Back to list
        </Link>
      </div>
    );
  }

  const properties = owner.properties || [];

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/owners" className="crumb">
              Owners
            </Link>
            <span aria-hidden="true"> / </span>
            #{owner.id}
          </p>
          <h2 className="page-toolbar__title">{owner.ownerName}</h2>
          <div className="detail-meta">
            <StatusBadge status={owner.verificationStatus} />
          </div>
        </div>
        <div className="toolbar-actions">
          <FavoriteToggle entityType="owner" entityId={owner.id} />
          <Link to={`/owners/${owner.id}/edit`} className="btn btn--ghost">
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
        <section className="detail-card">
          <h3 className="detail-card__title">Profile</h3>
          <dl className="detail-list">
            <DetailRow label="CNIC" value={owner.cnic} />
            <DetailRow label="Phone" value={owner.phone} />
            <DetailRow label="Email" value={owner.email} />
            <DetailRow label="NTN" value={owner.ntn} />
            <DetailRow label="Address" value={owner.address} />
            <DetailRow label="Nominee" value={owner.nomineeName} />
            <DetailRow label="Nominee CNIC" value={owner.nomineeCnic} />
            <DetailRow label="Nominee relation" value={owner.nomineeRelation} />
            <DetailRow label="Nominee contact" value={owner.nomineeContact} />
            <DetailRow label="POA holder" value={owner.poaHolderName} />
            <DetailRow label="POA details" value={owner.poaDetails} />
            <DetailRow label="Notes" value={owner.notes} />
            <DetailRow
              label="Verified at"
              value={
                owner.verifiedAt
                  ? new Date(owner.verifiedAt).toLocaleString()
                  : null
              }
            />
          </dl>
        </section>

        <div className="detail-side">
          <section className="detail-card">
            <h3 className="detail-card__title">Verification</h3>
            <div className="status-form">
              <select
                value={verification}
                onChange={(e) => setVerification(e.target.value)}
                disabled={savingVerification}
              >
                {VERIFICATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {formatLabel(s)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn--primary btn--inline"
                disabled={
                  savingVerification ||
                  verification === owner.verificationStatus
                }
                onClick={handleVerification}
              >
                {savingVerification ? "Updating…" : "Update verification"}
              </button>
            </div>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Linked properties</h3>
            {properties.length === 0 ? (
              <p className="muted">No properties linked.</p>
            ) : (
              <ul className="simple-list">
                {properties.map((p) => (
                  <li key={p.linkId || `${p.propertyId}-${p.sharePercentage}`}>
                    <Link to={`/properties/${p.propertyId}`} className="linkish">
                      {p.propertyTitle || p.propertyCode || `#${p.propertyId}`}
                    </Link>
                    <span className="muted">
                      {" "}
                      · {p.sharePercentage}% · {formatLabel(p.propertyStatus)}
                      {p.isPrimary ? " · Primary" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Archive owner?"
        message={`"${owner.ownerName}" will be soft-deleted and moved to the recycle bin.`}
        confirmLabel="Archive"
        danger
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
