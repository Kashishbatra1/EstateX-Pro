export default function CancelBookingDialog({
  open,
  loading = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <form
        className="dialog dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-booking-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onConfirm({
            cancellationReason: String(fd.get("cancellationReason") || "").trim(),
            refundAmount: String(fd.get("refundAmount") || "").trim(),
            refundDetails: String(fd.get("refundDetails") || "").trim(),
          });
        }}
      >
        <h2 id="cancel-booking-title" className="dialog__title">
          Cancel booking
        </h2>
        <p className="dialog__message">
          Cancellation follows backend rules. A reason is required. Optional
          refund fields are stored as metadata only.
        </p>

        <label className="field">
          <span className="field__label">Cancellation reason *</span>
          <textarea
            name="cancellationReason"
            rows={3}
            required
            disabled={loading}
          />
        </label>

        <label className="field">
          <span className="field__label">Refund amount (optional)</span>
          <input
            type="number"
            name="refundAmount"
            min="0"
            step="1"
            disabled={loading}
          />
        </label>

        <label className="field">
          <span className="field__label">Refund details (optional)</span>
          <textarea name="refundDetails" rows={2} disabled={loading} />
        </label>

        <div className="dialog__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Keep booking
          </button>
          <button
            type="submit"
            className="btn btn--danger"
            disabled={loading}
          >
            {loading ? "Cancelling…" : "Cancel booking"}
          </button>
        </div>
      </form>
    </div>
  );
}
