/**
 * Lightweight horizontal bar chart from backend-provided numeric series.
 * Does not invent or recalculate values — only visualizes `{ label, value }`.
 */
export default function DistributionChart({ title, series = [], emptyLabel = "No data" }) {
  const max = Math.max(0, ...series.map((s) => Number(s.value) || 0));
  const total = series.reduce((sum, s) => sum + (Number(s.value) || 0), 0);

  return (
    <section className="dist-chart">
      {title ? <h3 className="dist-chart__title">{title}</h3> : null}
      {total === 0 ? (
        <p className="muted dist-chart__empty">{emptyLabel}</p>
      ) : (
        <ul className="dist-chart__list">
          {series.map((item) => {
            const value = Number(item.value) || 0;
            const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
            return (
              <li key={item.label} className="dist-chart__row">
                <span className="dist-chart__label">{item.label}</span>
                <div className="dist-chart__track" aria-hidden="true">
                  <span
                    className="dist-chart__bar"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="dist-chart__value mono">{value}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
