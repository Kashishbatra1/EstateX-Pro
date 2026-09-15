export default function StatusBadge({ status }) {
  const value = String(status || "unknown").toLowerCase();
  return (
    <span className={`status-badge status-badge--${value}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}
