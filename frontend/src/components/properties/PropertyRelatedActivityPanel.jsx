import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listBookings } from "../../api/bookings.js";
import { listPayments } from "../../api/payments.js";
import { listCommissions } from "../../api/commissions.js";
import { listPropertyTransfers } from "../../api/transfers.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../StatusBadge.jsx";
import { formatMoney } from "../../utils/format.js";
import { formatLabel } from "../../utils/propertyHelpers.js";

function SectionHeader({ title, to, actionLabel }) {
  return (
    <div className="related-activity__head">
      <h4 className="related-activity__subtitle">{title}</h4>
      {to ? (
        <Link to={to} className="btn btn--tiny btn--ghost">
          {actionLabel || "View all"}
        </Link>
      ) : null}
    </div>
  );
}

export default function PropertyRelatedActivityPanel({ propertyId }) {
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [bookingsRes, paymentsRes, commissionsRes, transfersRes] =
          await Promise.all([
            listBookings({ propertyId, limit: 8 }),
            listPayments({ propertyId, limit: 8 }),
            listCommissions({ propertyId, limit: 8 }),
            listPropertyTransfers(propertyId),
          ]);
        if (cancelled) return;
        setBookings(bookingsRes.items || []);
        setPayments(paymentsRes.items || []);
        setCommissions(commissionsRes.items || []);
        setTransfers((transfersRes.items || []).slice(0, 8));
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Failed to load related activity"
        );
        setBookings([]);
        setPayments([]);
        setCommissions([]);
        setTransfers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const clients = useMemo(() => {
    const map = new Map();
    bookings.forEach((b) => {
      if (!b.clientId) return;
      if (!map.has(b.clientId)) {
        map.set(b.clientId, {
          id: b.clientId,
          name: b.clientName || `Client #${b.clientId}`,
          bookingCode: b.bookingCode,
          bookingId: b.id,
        });
      }
    });
    return Array.from(map.values());
  }, [bookings]);

  return (
    <section className="detail-card" id="related-activity">
      <div className="detail-card__header-row">
        <h3 className="detail-card__title">Related activity</h3>
        <div className="related-nav related-nav--compact">
          <Link
            to={`/bookings?propertyId=${propertyId}`}
            className="btn btn--tiny btn--ghost"
          >
            Bookings
          </Link>
          <Link
            to={`/payments?propertyId=${propertyId}`}
            className="btn btn--tiny btn--ghost"
          >
            Payments
          </Link>
          <Link
            to={`/commissions?propertyId=${propertyId}`}
            className="btn btn--tiny btn--ghost"
          >
            Commissions
          </Link>
          <Link
            to={`/transfers?propertyId=${propertyId}`}
            className="btn btn--tiny btn--ghost"
          >
            Transfers
          </Link>
        </div>
      </div>
      <p className="muted tiny">
        Live bookings, payments, clients, commissions, and transfers linked to
        this property.
      </p>

      {loading ? (
        <p className="muted">Loading related records…</p>
      ) : null}
      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="related-activity">
          <div className="related-activity__block">
            <SectionHeader
              title="Bookings"
              to={`/bookings?propertyId=${propertyId}`}
            />
            {bookings.length === 0 ? (
              <p className="muted">No bookings yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table data-table--compact">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Client</th>
                      <th>Status</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <Link to={`/bookings/${b.id}`} className="linkish">
                            {b.bookingCode || `#${b.id}`}
                          </Link>
                        </td>
                        <td>
                          {b.clientId ? (
                            <Link
                              to={`/clients/${b.clientId}`}
                              className="linkish"
                            >
                              {b.clientName || `Client #${b.clientId}`}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <StatusBadge status={b.status} />
                        </td>
                        <td>
                          {b.agreedPrice != null
                            ? formatMoney(b.agreedPrice)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="related-activity__block">
            <SectionHeader
              title="Clients (via bookings)"
              to={`/bookings?propertyId=${propertyId}`}
              actionLabel="Open bookings"
            />
            {clients.length === 0 ? (
              <p className="muted">No clients linked through bookings yet.</p>
            ) : (
              <ul className="simple-list">
                {clients.map((c) => (
                  <li key={c.id} className="link-row">
                    <div>
                      <Link to={`/clients/${c.id}`} className="linkish">
                        {c.name}
                      </Link>
                      <span className="muted">
                        {" "}
                        · via{" "}
                        <Link to={`/bookings/${c.bookingId}`} className="linkish">
                          {c.bookingCode || `Booking #${c.bookingId}`}
                        </Link>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="related-activity__block">
            <SectionHeader
              title="Payments"
              to={`/payments?propertyId=${propertyId}`}
            />
            {payments.length === 0 ? (
              <p className="muted">No payments for this property yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table data-table--compact">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Booking</th>
                      <th>Amount</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link to={`/payments/${p.id}`} className="linkish">
                            {p.paymentCode || `#${p.id}`}
                          </Link>
                        </td>
                        <td>
                          {p.bookingId ? (
                            <Link
                              to={`/bookings/${p.bookingId}`}
                              className="linkish"
                            >
                              {p.bookingCode || `B#${p.bookingId}`}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {p.amount != null ? formatMoney(p.amount) : "—"}
                        </td>
                        <td>
                          {p.paymentDate
                            ? new Date(p.paymentDate).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="related-activity__block">
            <SectionHeader
              title="Commissions & brokerage"
              to={`/commissions?propertyId=${propertyId}`}
            />
            {commissions.length === 0 ? (
              <p className="muted">No commission records yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table data-table--compact">
                  <thead>
                    <tr>
                      <th>Record</th>
                      <th>Client / agent</th>
                      <th>Status</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link to={`/commissions/${c.id}`} className="linkish">
                            {c.bookingCode || `Commission #${c.id}`}
                          </Link>
                          {c.commissionPercentage != null ? (
                            <div className="muted tiny">
                              {c.commissionPercentage}%
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {c.clientName ||
                            c.assignedAgentName ||
                            c.referralSource ||
                            "—"}
                        </td>
                        <td>
                          <StatusBadge status={c.paymentStatus} />
                        </td>
                        <td>
                          {c.finalAmount != null
                            ? formatMoney(c.finalAmount)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="related-activity__block">
            <SectionHeader
              title="Resale & transfers"
              to={`/transfers?propertyId=${propertyId}`}
            />
            {transfers.length === 0 ? (
              <p className="muted">No transfers recorded yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table data-table--compact">
                  <thead>
                    <tr>
                      <th>Transfer</th>
                      <th>Type</th>
                      <th>Parties</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <Link to={`/transfers/${t.id}`} className="linkish">
                            Transfer #{t.id}
                          </Link>
                        </td>
                        <td>{formatLabel(t.transferType) || "—"}</td>
                        <td>
                          {(t.fromOwnerName || t.fromClientName || "—") +
                            " → " +
                            (t.toOwnerName || t.toClientName || "—")}
                        </td>
                        <td>
                          {t.transferDate
                            ? new Date(t.transferDate).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
