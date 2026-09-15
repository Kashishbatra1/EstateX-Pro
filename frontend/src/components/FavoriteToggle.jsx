import { useCallback, useEffect, useState } from "react";
import { addFavorite, listFavorites, removeFavorite } from "../api/favorites.js";
import { ApiError } from "../api/client.js";

/**
 * Pin / unpin toggle for favoritable entities (property, client, owner, vendor, booking, expense).
 */
export default function FavoriteToggle({ entityType, entityId, className = "" }) {
  const [favoriteId, setFavoriteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!entityType || entityId == null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const items = await listFavorites({
        entityType,
        entityId: Number(entityId),
      });
      setFavoriteId(items[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load favorite");
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle() {
    if (busy || loading || entityId == null) return;
    setBusy(true);
    setError("");
    try {
      if (favoriteId) {
        await removeFavorite(favoriteId);
        setFavoriteId(null);
      } else {
        const fav = await addFavorite({
          entityType,
          entityId: Number(entityId),
        });
        setFavoriteId(fav?.id ?? null);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await load();
      } else {
        setError(err instanceof ApiError ? err.message : "Favorite update failed");
      }
    } finally {
      setBusy(false);
    }
  }

  const pinned = Boolean(favoriteId);

  return (
    <span className={`favorite-toggle ${className}`.trim()}>
      <button
        type="button"
        className={`btn btn--ghost btn--inline${pinned ? " favorite-toggle--on" : ""}`}
        onClick={toggle}
        disabled={busy || loading || entityId == null}
        aria-pressed={pinned}
        title={pinned ? "Remove from favorites" : "Add to favorites"}
      >
        {busy || loading ? "…" : pinned ? "★ Favorited" : "☆ Favorite"}
      </button>
      {error ? <span className="field__error">{error}</span> : null}
    </span>
  );
}
