import { Link } from "react-router-dom";

/**
 * Shared loading / empty / error panels for consistent page states.
 */
export function LoadingState({ message = "Loading…" }) {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  message,
  actionLabel,
  actionTo,
  onAction,
}) {
  return (
    <div className="state-panel state-panel--empty">
      {title ? <p className="state-panel__title">{title}</p> : null}
      {message ? <p className="muted">{message}</p> : null}
      {actionTo && actionLabel ? (
        <Link to={actionTo} className="btn btn--primary btn--inline">
          {actionLabel}
        </Link>
      ) : null}
      {!actionTo && actionLabel && onAction ? (
        <button type="button" className="btn btn--primary btn--inline" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong", onRetry }) {
  return (
    <div className="state-panel state-panel--error" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn--ghost" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
