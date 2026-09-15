/**
 * Dual/single monthly trend bars from backend series.
 * Expects items like { label|month, sales, rentals } or { label|month, value }.
 */
export default function TrendChart({
  title,
  series = [],
  emptyLabel = "No data yet",
  mode = "dual", // dual = sales/rentals, single = value
  formatValue,
}) {
  const fmt = formatValue || ((n) => String(n));
  const max = Math.max(
    0,
    ...series.flatMap((s) =>
      mode === "dual"
        ? [Number(s.sales) || 0, Number(s.rentals) || 0]
        : [Number(s.value) || 0]
    )
  );
  const hasData = series.some((s) =>
    mode === "dual"
      ? Number(s.sales) > 0 || Number(s.rentals) > 0
      : Number(s.value) > 0
  );

  return (
    <section className="dist-chart trend-chart">
      {title ? <h3 className="dist-chart__title">{title}</h3> : null}
      {!hasData ? (
        <p className="muted dist-chart__empty">{emptyLabel}</p>
      ) : (
        <>
          {mode === "dual" ? (
            <div className="trend-chart__legend">
              <span className="trend-chart__swatch trend-chart__swatch--sales" />
              Sales
              <span className="trend-chart__swatch trend-chart__swatch--rentals" />
              Rentals
            </div>
          ) : null}
          <ul className="trend-chart__list">
            {series.map((item) => {
              const label = item.label || item.month;
              if (mode === "dual") {
                const sales = Number(item.sales) || 0;
                const rentals = Number(item.rentals) || 0;
                const salesW = max > 0 ? Math.max((sales / max) * 100, sales > 0 ? 3 : 0) : 0;
                const rentalsW =
                  max > 0 ? Math.max((rentals / max) * 100, rentals > 0 ? 3 : 0) : 0;
                return (
                  <li key={label} className="trend-chart__row">
                    <span className="trend-chart__label">{label}</span>
                    <div className="trend-chart__bars">
                      <div className="trend-chart__track" title={`Sales ${fmt(sales)}`}>
                        <span
                          className="trend-chart__bar trend-chart__bar--sales"
                          style={{ width: `${salesW}%` }}
                        />
                      </div>
                      <div className="trend-chart__track" title={`Rentals ${fmt(rentals)}`}>
                        <span
                          className="trend-chart__bar trend-chart__bar--rentals"
                          style={{ width: `${rentalsW}%` }}
                        />
                      </div>
                    </div>
                    <span className="trend-chart__values muted tiny">
                      {fmt(sales)} / {fmt(rentals)}
                    </span>
                  </li>
                );
              }
              const value = Number(item.value) || 0;
              const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0;
              return (
                <li key={label} className="trend-chart__row">
                  <span className="trend-chart__label">{label}</span>
                  <div className="trend-chart__bars">
                    <div className="trend-chart__track">
                      <span
                        className="trend-chart__bar trend-chart__bar--single"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                  <span className="trend-chart__values muted tiny">{fmt(value)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
