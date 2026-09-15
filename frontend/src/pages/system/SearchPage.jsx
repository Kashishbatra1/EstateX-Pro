import { useState } from "react";
import { Link } from "react-router-dom";
import { globalSearch } from "../../api/system.js";
import { ApiError } from "../../api/client.js";
import "../../styles/properties.css";

function Group({ title, items }) {
  if (!items?.length) return null;
  return (
    <section className="detail-card">
      <h3 className="detail-card__title">{title}</h3>
      <ul className="docs-list">
        {items.map((item) => (
          <li key={`${item.type}-${item.id}`} className="docs-list__item">
            <div>
              <strong>{item.label}</strong>
              {item.code ? (
                <div className="muted tiny">{item.code}</div>
              ) : null}
            </div>
            <Link to={item.path} className="btn btn--tiny btn--ghost">
              Open
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      setResult(await globalSearch(q.trim()));
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="properties-page">
      <div className="page-toolbar">
        <div>
          <p className="page-toolbar__eyebrow">System</p>
          <h2 className="page-toolbar__title">Global Search</h2>
        </div>
      </div>

      <form className="filters-bar" onSubmit={handleSearch}>
        <input
          className="filters-bar__search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search properties, clients, owners, vendors, expenses…"
        />
        <button type="submit" className="btn btn--primary btn--inline" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error ? <div className="alert alert--error">{error}</div> : null}

      {!result && !loading && !error ? (
        <div className="state-panel state-panel--empty">
          <p className="state-panel__title">Search the office records</p>
          <p className="muted">
            Find properties, clients, owners, vendors, and expenses by name or code.
          </p>
        </div>
      ) : null}

      {result ? (
        <div className="detail-stack">
          <Group title="Properties" items={result.properties} />
          <Group title="Clients" items={result.clients} />
          <Group title="Owners" items={result.owners} />
          <Group title="Vendors" items={result.vendors} />
          <Group title="Expenses" items={result.expenses} />
          {!result.properties?.length &&
          !result.clients?.length &&
          !result.owners?.length &&
          !result.vendors?.length &&
          !result.expenses?.length ? (
            <p className="muted">No matches for “{result.q}”.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
