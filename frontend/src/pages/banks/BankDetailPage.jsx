import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getBankAccount, deleteBankAccount } from "../../api/banks.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { formatLabel, maskAccountNumber } from "../../utils/bankHelpers.js";
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

export default function BankDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [bank, setBank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [actionError, setActionError] = useState("");
  const [showFullAccount, setShowFullAccount] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getBankAccount(id);
      setBank(data);
    } catch (err) {
      setBank(null);
      setError(
        err instanceof ApiError ? err.message : "Failed to load bank account"
      );
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

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteBankAccount(id);
      navigate("/banks", {
        replace: true,
        state: { flash: "Bank account moved to recycle bin" },
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
        <p>Loading bank account…</p>
      </div>
    );
  }

  if (error || !bank) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{error || "Bank account not found"}</p>
        <Link to="/banks" className="btn btn--ghost">
          Back to list
        </Link>
      </div>
    );
  }

  const properties = bank.properties || [];

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/banks" className="crumb">
              Banks
            </Link>
            <span aria-hidden="true"> / </span>
            #{bank.id}
          </p>
          <h2 className="page-toolbar__title">{bank.bankName}</h2>
          <div className="detail-meta">
            <StatusBadge status={bank.isActive ? "available" : "draft"} />
            <span className="muted">
              {bank.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <div className="toolbar-actions">
          <Link to={`/banks/${bank.id}/edit`} className="btn btn--ghost">
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
          <h3 className="detail-card__title">Account details</h3>
          <dl className="detail-list">
            <DetailRow label="Account holder" value={bank.accountHolderName} />
            <DetailRow
              label="Account number"
              value={
                <span className="account-reveal">
                  {showFullAccount
                    ? bank.accountNumber
                    : maskAccountNumber(bank.accountNumber)}
                  <button
                    type="button"
                    className="btn btn--tiny"
                    onClick={() => setShowFullAccount((v) => !v)}
                  >
                    {showFullAccount ? "Hide" : "Reveal"}
                  </button>
                </span>
              }
            />
            <DetailRow label="IBAN" value={bank.iban} />
            <DetailRow label="Branch" value={bank.branchName} />
            <DetailRow label="Details" value={bank.accountDetails} />
            <DetailRow
              label="Created"
              value={
                bank.createdAt
                  ? new Date(bank.createdAt).toLocaleString()
                  : null
              }
            />
          </dl>
        </section>

        <section className="detail-card">
          <h3 className="detail-card__title">Linked properties</h3>
          {properties.length === 0 ? (
            <p className="muted">No properties linked.</p>
          ) : (
            <ul className="simple-list">
              {properties.map((p) => (
                <li key={p.linkId || p.propertyId}>
                  <Link to={`/properties/${p.propertyId}`} className="linkish">
                    {p.propertyTitle || p.propertyCode || `#${p.propertyId}`}
                  </Link>
                  <span className="muted">
                    {" "}
                    · {formatLabel(p.propertyStatus)}
                    {p.isPrimary ? " · Primary" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Archive bank account?"
        message={`"${bank.bankName}" will be soft-deleted, deactivated, and removed from the active list.`}
        confirmLabel="Archive"
        danger
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
