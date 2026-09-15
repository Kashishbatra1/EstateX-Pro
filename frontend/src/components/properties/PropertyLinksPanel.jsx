import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listOwners } from "../../api/owners.js";
import { listBankAccounts } from "../../api/banks.js";
import {
  linkPropertyOwner,
  unlinkPropertyOwner,
  linkPropertyBank,
  unlinkPropertyBank,
} from "../../api/properties.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../StatusBadge.jsx";
import { formatLabel } from "../../utils/ownerHelpers.js";
import { maskAccountNumber } from "../../utils/bankHelpers.js";

/**
 * Smallest safe Property ↔ Owner / Bank linking UI for listing readiness.
 */
export default function PropertyLinksPanel({ property, onChanged }) {
  const propertyId = property?.id;
  const owners = property?.owners || [];
  const banks = property?.bankAccounts || [];

  const [ownerOptions, setOwnerOptions] = useState([]);
  const [bankOptions, setBankOptions] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [ownerId, setOwnerId] = useState("");
  const [sharePercentage, setSharePercentage] = useState("100");
  const [isPrimaryOwner, setIsPrimaryOwner] = useState(true);
  const [ownershipDocumentType, setOwnershipDocumentType] = useState("");

  const [bankAccountId, setBankAccountId] = useState("");
  const [isPrimaryBank, setIsPrimaryBank] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listOwners({ limit: 100 }),
      listBankAccounts({ limit: 100, isActive: "true" }),
    ])
      .then(([ownersRes, banksRes]) => {
        if (cancelled) return;
        setOwnerOptions(ownersRes.items || []);
        setBankOptions(banksRes.items || []);
      })
      .catch(() => {
        if (!cancelled) {
          setOwnerOptions([]);
          setBankOptions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function flash(text) {
    setMessage(text);
    setError("");
    setTimeout(() => setMessage(""), 2800);
  }

  async function handleLinkOwner(event) {
    event.preventDefault();
    if (!ownerId) {
      setError("Select an owner to link");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await linkPropertyOwner(propertyId, {
        ownerId: Number(ownerId),
        sharePercentage: Number(sharePercentage),
        isPrimary: isPrimaryOwner,
        ownershipDocumentType: ownershipDocumentType.trim() || null,
      });
      setOwnerId("");
      flash("Owner linked");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to link owner");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlinkOwner(linkedOwnerId) {
    setBusy(true);
    setError("");
    try {
      await unlinkPropertyOwner(propertyId, linkedOwnerId);
      flash("Owner unlinked");
      await onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to unlink owner"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLinkBank(event) {
    event.preventDefault();
    if (!bankAccountId) {
      setError("Select a bank account to link");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await linkPropertyBank(propertyId, {
        bankAccountId: Number(bankAccountId),
        isPrimary: isPrimaryBank,
      });
      setBankAccountId("");
      flash("Bank account linked");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to link bank");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlinkBank(linkedBankId) {
    setBusy(true);
    setError("");
    try {
      await unlinkPropertyBank(propertyId, linkedBankId);
      flash("Bank account unlinked");
      await onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to unlink bank"
      );
    } finally {
      setBusy(false);
    }
  }

  const linkedOwnerIds = new Set(owners.map((o) => o.ownerId));
  const linkedBankIds = new Set(banks.map((b) => b.bankAccountId));
  const availableOwners = ownerOptions.filter((o) => !linkedOwnerIds.has(o.id));
  const availableBanks = bankOptions.filter((b) => !linkedBankIds.has(b.id));

  return (
    <div className="link-panels">
      {message ? <div className="toast toast--success">{message}</div> : null}
      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="detail-card">
        <h3 className="detail-card__title">Owners</h3>
        {owners.length === 0 ? (
          <p className="muted">No owners linked yet.</p>
        ) : (
          <ul className="simple-list">
            {owners.map((o) => (
              <li key={o.id} className="link-row">
                <div>
                  <Link to={`/owners/${o.ownerId}`} className="linkish">
                    {o.ownerName || `Owner #${o.ownerId}`}
                  </Link>
                  <span className="muted">
                    {" "}
                    · {o.sharePercentage}% ·{" "}
                    {formatLabel(o.verificationStatus)}
                    {o.isPrimary ? " · Primary" : ""}
                  </span>
                  <div>
                    <StatusBadge status={o.verificationStatus} />
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--tiny btn--danger-text"
                  disabled={busy}
                  onClick={() => handleUnlinkOwner(o.ownerId)}
                >
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="inline-link-form" onSubmit={handleLinkOwner}>
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            disabled={busy}
          >
            <option value="">Select owner…</option>
            {availableOwners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.ownerName} ({formatLabel(o.verificationStatus)})
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            value={sharePercentage}
            onChange={(e) => setSharePercentage(e.target.value)}
            disabled={busy}
            aria-label="Share percentage"
            placeholder="Share %"
          />
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={isPrimaryOwner}
              onChange={(e) => setIsPrimaryOwner(e.target.checked)}
              disabled={busy}
            />
            Primary
          </label>
          <input
            type="text"
            value={ownershipDocumentType}
            onChange={(e) => setOwnershipDocumentType(e.target.value)}
            disabled={busy}
            placeholder="Document type (optional)"
          />
          <button
            type="submit"
            className="btn btn--primary btn--inline"
            disabled={busy || availableOwners.length === 0}
          >
            Link owner
          </button>
        </form>
        {availableOwners.length === 0 ? (
          <p className="form-hint">
            No more owners available to link.{" "}
            <Link to="/owners/new">Add an owner</Link>.
          </p>
        ) : null}
      </section>

      <section className="detail-card">
        <h3 className="detail-card__title">Owner bank accounts</h3>
        {banks.length === 0 ? (
          <p className="muted">No bank accounts linked yet.</p>
        ) : (
          <ul className="simple-list">
            {banks.map((b) => (
              <li key={b.id} className="link-row">
                <div>
                  <Link to={`/banks/${b.bankAccountId}`} className="linkish">
                    {b.bankName || `Bank #${b.bankAccountId}`}
                  </Link>
                  <span className="muted">
                    {" "}
                    · {b.accountHolderName || "—"} ·{" "}
                    {maskAccountNumber(b.accountNumber)}
                    {b.isPrimary ? " · Primary" : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--tiny btn--danger-text"
                  disabled={busy}
                  onClick={() => handleUnlinkBank(b.bankAccountId)}
                >
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="inline-link-form" onSubmit={handleLinkBank}>
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            disabled={busy}
          >
            <option value="">Select bank account…</option>
            {availableBanks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bankName} — {b.accountHolderName} (
                {maskAccountNumber(b.accountNumber)})
              </option>
            ))}
          </select>
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={isPrimaryBank}
              onChange={(e) => setIsPrimaryBank(e.target.checked)}
              disabled={busy}
            />
            Primary
          </label>
          <button
            type="submit"
            className="btn btn--primary btn--inline"
            disabled={busy || availableBanks.length === 0}
          >
            Link bank
          </button>
        </form>
        {availableBanks.length === 0 ? (
          <p className="form-hint">
            No more active bank accounts available.{" "}
            <Link to="/banks/new">Add a bank account</Link>.
          </p>
        ) : null}
      </section>
    </div>
  );
}
