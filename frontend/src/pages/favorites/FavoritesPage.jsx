import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listFavorites, removeFavorite } from "../../api/favorites.js";
import { ApiError } from "../../api/client.js";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/ui/PageStates.jsx";
import "../../styles/properties.css";

function formatEntityType(type) {
  if (!type) return "Item";
  return String(type)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function FavoritesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await listFavorites());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load favorites");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRemove(id) {
    setBusyId(id);
    try {
      await removeFavorite(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove favorite");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">Workspace</p>
          <h2 className="page-toolbar__title">Favorites</h2>
          <p className="muted tiny" style={{ marginTop: "0.35rem" }}>
            Pinned properties, clients, bookings, and other records for quick access.
          </p>
        </div>
        <div className="page-toolbar__actions">
          <Link to="/properties" className="btn btn--ghost btn--inline">
            Browse properties
          </Link>
          <Link to="/clients" className="btn btn--ghost btn--inline">
            Browse clients
          </Link>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? <LoadingState message="Loading favorites…" /> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No favorites yet"
          message="Open a property, client, booking, expense, owner, or vendor detail page and use Pin to add it here."
          actionLabel="Go to properties"
          actionTo="/properties"
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="docs-list">
          {items.map((f) => (
            <li key={f.id} className="docs-list__item">
              <div>
                <strong>{f.label || `#${f.entityId}`}</strong>
                <div className="muted tiny">{formatEntityType(f.entityType)}</div>
              </div>
              <div className="docs-list__actions">
                {f.path ? (
                  <Link to={f.path} className="btn btn--tiny btn--ghost">
                    Open
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="btn btn--tiny btn--danger-text"
                  disabled={busyId === f.id}
                  onClick={() => handleRemove(f.id)}
                >
                  {busyId === f.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
