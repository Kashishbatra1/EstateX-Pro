import { useCallback, useEffect, useState } from "react";
import {
  listRecycleBin,
  restoreRecycleItem,
  purgeRecycleItem,
} from "../../api/system.js";
import { ApiError } from "../../api/client.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import "../../styles/properties.css";

export default function RecycleBinPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listRecycleBin({
        search: search || undefined,
        entityType: entityType || undefined,
        limit: 50,
      });
      setItems(data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load recycle bin");
    } finally {
      setLoading(false);
    }
  }, [search, entityType]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(""), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  async function handleRestore(item) {
    setError("");
    setBusy(true);
    try {
      await restoreRecycleItem(item.entityType, item.entityId);
      setFlash(`Restored ${item.displayName}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  async function handlePurgeConfirm() {
    if (!purgeTarget) return;
    setError("");
    setBusy(true);
    try {
      await purgeRecycleItem(purgeTarget.entityType, purgeTarget.entityId);
      setFlash(`Permanently deleted ${purgeTarget.displayName}`);
      setPurgeTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Permanent delete failed");
      setPurgeTarget(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">System</p>
          <h2 className="page-toolbar__title">Recycle Bin</h2>
          <p className="muted tiny">
            Restore soft-deleted records, or permanently delete them from the database.
          </p>
        </div>
      </div>
      {flash ? <div className="alert alert--success">{flash}</div> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      <form
        className="filters-bar"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input
          className="filters-bar__search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search deleted items…"
        />
        <input
          type="text"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          placeholder="entity type e.g. property"
        />
        <button type="submit" className="btn btn--soft btn--inline">
          Filter
        </button>
      </form>

      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="muted">Recycle bin is empty.</p>
      ) : null}

      <ul className="docs-list">
        {items.map((item) => (
          <li
            key={`${item.entityType}-${item.entityId}`}
            className="docs-list__item"
          >
            <div>
              <strong>{item.displayName}</strong>
              <div className="muted tiny">
                {item.entityType} #{item.entityId}
                {item.deletedAt
                  ? ` · deleted ${new Date(item.deletedAt).toLocaleString()}`
                  : ""}
              </div>
            </div>
            <div className="docs-list__actions recycle-bin__actions">
              <button
                type="button"
                className="btn btn--soft btn--inline"
                disabled={busy}
                onClick={() => handleRestore(item)}
              >
                Restore
              </button>
              <button
                type="button"
                className="btn btn--danger-outline btn--inline"
                disabled={busy}
                onClick={() => setPurgeTarget(item)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(purgeTarget)}
        title="Delete permanently?"
        message={
          purgeTarget
            ? `“${purgeTarget.displayName}” will be permanently removed from the database. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete forever"
        danger
        loading={busy}
        onCancel={() => {
          if (!busy) setPurgeTarget(null);
        }}
        onConfirm={handlePurgeConfirm}
      />
    </div>
  );
}
