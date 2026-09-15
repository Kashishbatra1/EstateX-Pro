import { useEffect, useState } from "react";
import { apiRequest } from "../../api/client.js";
import { ApiError } from "../../api/client.js";
import "../../styles/properties.css";

async function listBackups() {
  const result = await apiRequest("/api/backups");
  return result.data?.items ?? [];
}

async function createBackup() {
  const result = await apiRequest("/api/backups", { method: "POST", body: {} });
  return result.data?.backup ?? null;
}

async function restoreBackup(id) {
  const result = await apiRequest(`/api/backups/${id}/restore`, {
    method: "POST",
    body: {},
  });
  return result.data?.backup ?? null;
}

export default function BackupsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await listBackups());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load backups");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">System</p>
          <h2 className="page-toolbar__title">Backup & Restore</h2>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--inline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await createBackup();
              setFlash("Backup snapshot created");
              await load();
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Backup failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          Create backup
        </button>
      </div>
      <p className="muted">
        Creates a logical JSON metadata snapshot (counts) under the server
        uploads folder and records it in the backups table.
      </p>
      {flash ? <div className="alert alert--success">{flash}</div> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}
      {loading ? <p className="muted">Loading…</p> : null}
      <ul className="docs-list">
        {items.map((b) => (
          <li key={b.id} className="docs-list__item">
            <div>
              <strong>{b.fileName}</strong>
              <div className="muted tiny">
                {b.status} · {b.backupType}
                {b.sizeBytes != null ? ` · ${b.sizeBytes} bytes` : ""}
                {b.createdAt ? ` · ${new Date(b.createdAt).toLocaleString()}` : ""}
              </div>
            </div>
            {b.status === "completed" ? (
              <button
                type="button"
                className="btn btn--ghost btn--inline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await restoreBackup(b.id);
                    setFlash("Backup marked restored");
                    await load();
                  } catch (err) {
                    setError(
                      err instanceof ApiError ? err.message : "Restore failed"
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Mark restored
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
