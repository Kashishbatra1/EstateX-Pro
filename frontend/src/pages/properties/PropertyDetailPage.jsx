import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getProperty,
  updatePropertyStatus,
  deleteProperty,
} from "../../api/properties.js";
import { ApiError } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import FavoriteToggle from "../../components/FavoriteToggle.jsx";
import PropertyLinksPanel from "../../components/properties/PropertyLinksPanel.jsx";
import PropertyHistoryTimeline from "../../components/properties/PropertyHistoryTimeline.jsx";
import PropertyDocumentsMedia from "../../components/properties/PropertyDocumentsMedia.jsx";
import PropertyVisitsPanel from "../../components/properties/PropertyVisitsPanel.jsx";
import PropertyRelatedActivityPanel from "../../components/properties/PropertyRelatedActivityPanel.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  PROPERTY_STATUSES,
  FEATURE_FLAGS,
  formatLabel,
  locationLabel,
  priceLabel,
  parseFeatureMeta,
} from "../../utils/propertyHelpers.js";
import "../../styles/properties.css";

const DETAIL_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "location", label: "Location" },
  { id: "financial", label: "Financial" },
  { id: "owners-banks", label: "Owners & banks" },
  { id: "property-details", label: "Details" },
  { id: "related-activity", label: "Related" },
  { id: "history", label: "History" },
  { id: "visits", label: "Visits" },
  { id: "documents", label: "Documents" },
];

function DetailRow({ label, value }) {
  if (value === null || value === undefined || value === "") {
    return (
      <div className="detail-row">
        <dt>{label}</dt>
        <dd>—</dd>
      </div>
    );
  }
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [statusValue, setStatusValue] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getProperty(id);
      setProperty(data);
      setStatusValue(data?.status || "");
    } catch (err) {
      setProperty(null);
      setError(err instanceof ApiError ? err.message : "Failed to load property");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(""), 3200);
    return () => clearTimeout(t);
  }, [flash]);

  async function handleStatusSave() {
    if (!property || !statusValue || statusValue === property.status) return;
    setStatusError("");
    setStatusSaving(true);
    try {
      const updated = await updatePropertyStatus(id, statusValue);
      setProperty(updated);
      setStatusValue(updated.status);
      setFlash(`Status updated to ${updated.status}`);
    } catch (err) {
      const details = err instanceof ApiError ? err.details : null;
      let message = err instanceof ApiError ? err.message : "Status update failed";
      if (details?.missing && Array.isArray(details.missing) && details.missing.length) {
        message = `${message}: ${details.missing.join(", ")}`;
      }
      setStatusError(message);
    } finally {
      setStatusSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteProperty(id);
      navigate("/properties", {
        replace: true,
        state: { flash: "Property moved to recycle bin" },
      });
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : "Archive failed");
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="state-panel">
        <div className="spinner" aria-hidden="true" />
        <p>Loading property…</p>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="state-panel state-panel--error" role="alert">
        <p>{error || "Property not found"}</p>
        <Link to="/properties" className="btn btn--ghost">
          Back to list
        </Link>
      </div>
    );
  }

  const readiness = property.listingReadiness;
  const owners = property.owners || [];
  const banks = property.bankAccounts || [];
  const primaryBank = banks.find((b) => b.isPrimary) || banks[0] || null;
  const primaryOwner =
    owners.find((o) => o.isPrimary) || owners[0] || null;
  const featureMeta = parseFeatureMeta(property.features?.appliances);
  const liftCount =
    property.features?.liftCount != null
      ? property.features.liftCount
      : featureMeta.liftCount || (property.features?.lift ? "1" : "");
  const cargoCount =
    property.features?.cargoCount != null
      ? property.features.cargoCount
      : featureMeta.cargoCount;
  const appliancesDisplay =
    property.features?.liftCount != null ||
    property.features?.cargoCount != null
      ? property.features?.appliances
      : featureMeta.appliances || property.features?.appliances;

  return (
    <div className="properties-page property-detail">
      <div className="property-hero">
        <div>
          <p className="page-toolbar__eyebrow">
            <Link to="/properties" className="crumb">
              Properties
            </Link>
            <span aria-hidden="true"> / </span>
            {property.propertyCode || `#${property.id}`}
          </p>
          <h2 className="page-toolbar__title">{property.title}</h2>
          <div className="detail-meta">
            <StatusBadge status={property.status} />
            <span className="muted">
              {formatLabel(property.purpose)} · {formatLabel(property.category)}
              {property.propertyType ? ` · ${property.propertyType}` : ""}
            </span>
            {property.isFeatured ? (
              <span className="pill-flag">Featured</span>
            ) : null}
          </div>
          <p className="property-hero__price">
            {priceLabel(property, formatMoney)}
          </p>
          <p className="muted">{locationLabel(property)}</p>
          <div className="property-hero__chips">
            <span className="meta-chip">
              Owners: {owners.length || 0}
              {primaryOwner ? (
                <>
                  {" · "}
                  <Link
                    to={`/owners/${primaryOwner.ownerId}`}
                    className="linkish"
                  >
                    {primaryOwner.ownerName || `Owner #${primaryOwner.ownerId}`}
                  </Link>
                </>
              ) : null}
            </span>
            <span className="meta-chip">
              Banks: {banks.length || 0}
              {primaryBank ? (
                <>
                  {" · "}
                  <Link
                    to={`/banks/${primaryBank.bankAccountId}`}
                    className="linkish"
                  >
                    {primaryBank.bankName ||
                      `Bank #${primaryBank.bankAccountId}`}
                  </Link>
                </>
              ) : null}
            </span>
          </div>
        </div>
        <div className="toolbar-actions">
          <FavoriteToggle entityType="property" entityId={property.id} />
          <Link
            to={`/properties/${property.id}/edit`}
            className="btn btn--ghost"
          >
            Edit
          </Link>
          <Link
            to={`/bookings/new?propertyId=${property.id}`}
            className="btn btn--primary btn--inline"
          >
            Create booking
          </Link>
          <Link
            to={`/commissions/new?propertyId=${property.id}`}
            className="btn btn--ghost"
          >
            Add commission
          </Link>
          <Link
            to={`/transfers/new?propertyId=${property.id}`}
            className="btn btn--ghost"
          >
            Record transfer
          </Link>
          <Link
            to={`/reports?tab=properties&propertyId=${property.id}`}
            className="btn btn--ghost"
          >
            Reports
          </Link>
          <button
            type="button"
            className="btn btn--danger-outline"
            onClick={() => setDeleteOpen(true)}
          >
            Archive
          </button>
        </div>
      </div>

      <nav className="detail-section-nav" aria-label="Property sections">
        {DETAIL_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="detail-section-nav__link"
          >
            {section.label}
          </a>
        ))}
      </nav>

      {flash ? <div className="toast toast--success">{flash}</div> : null}
      {statusError ? (
        <div className="alert alert--error" role="alert">
          {statusError}
        </div>
      ) : null}

      <div className="detail-layout detail-layout--wide">
        <div className="detail-stack">
          <section className="detail-card" id="overview">
            <h3 className="detail-card__title">Overview</h3>
            <dl className="detail-list detail-list--2">
              <DetailRow label="Property code" value={property.propertyCode} />
              <DetailRow label="Type" value={property.propertyType} />
              <DetailRow label="Purpose" value={formatLabel(property.purpose)} />
              <DetailRow
                label="Category"
                value={formatLabel(property.category)}
              />
              <DetailRow
                label="Layout"
                value={property.listingType || null}
              />
              <DetailRow
                label="Rating"
                value={
                  property.propertyRating != null
                    ? String(property.propertyRating)
                    : null
                }
              />
            </dl>
            {property.description ? (
              <div className="detail-description">
                <h4>Description</h4>
                <p>{property.description}</p>
              </div>
            ) : null}
          </section>

          <section className="detail-card" id="location">
            <h3 className="detail-card__title">Location</h3>
            <dl className="detail-list detail-list--2">
              <DetailRow label="City" value={property.city} />
              <DetailRow label="Area" value={property.area} />
              <DetailRow label="Society" value={property.society} />
              <DetailRow label="Block" value={property.block} />
              <DetailRow label="Street" value={property.street} />
              <DetailRow label="Floor" value={property.floor} />
              <DetailRow
                label="Flat / plot"
                value={property.flatOrPlotNumber}
              />
              <DetailRow
                label="Nearby landmarks"
                value={property.nearbyLandmarks}
              />
            </dl>
            {property.googleMapsUrl ? (
              <p className="detail-link">
                <a
                  href={property.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Maps
                </a>
              </p>
            ) : null}
            {property.videoWalkthroughUrl ? (
              <p className="detail-link">
                <a
                  href={property.videoWalkthroughUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Video walkthrough
                </a>
              </p>
            ) : null}
          </section>

          <section className="detail-card" id="financial">
            <h3 className="detail-card__title">Financial details</h3>
            <dl className="detail-list detail-list--2">
              <DetailRow
                label="Payment type"
                value={
                  property.primaryPaymentMethodName ||
                  (property.primaryPaymentMethodId
                    ? `Method #${property.primaryPaymentMethodId}`
                    : null)
                }
              />
              <DetailRow
                label="Bank"
                value={
                  primaryBank ? (
                    <Link
                      to={`/banks/${primaryBank.bankAccountId}`}
                      className="linkish"
                    >
                      {primaryBank.bankName ||
                        `Bank #${primaryBank.bankAccountId}`}
                    </Link>
                  ) : null
                }
              />
              <DetailRow
                label="Owner account"
                value={
                  primaryBank ? (
                    <span>
                      {[primaryBank.accountHolderName]
                        .filter(Boolean)
                        .join(" · ")}
                      {primaryBank.accountNumber
                        ? ` · ••••${String(primaryBank.accountNumber).slice(-4)}`
                        : ""}
                      {" · "}
                      <Link
                        to={`/banks/${primaryBank.bankAccountId}`}
                        className="linkish"
                      >
                        Open bank
                      </Link>
                    </span>
                  ) : null
                }
              />
              <DetailRow
                label="Primary owner"
                value={
                  primaryOwner ? (
                    <Link
                      to={`/owners/${primaryOwner.ownerId}`}
                      className="linkish"
                    >
                      {primaryOwner.ownerName ||
                        `Owner #${primaryOwner.ownerId}`}
                      {primaryOwner.sharePercentage != null
                        ? ` · ${primaryOwner.sharePercentage}%`
                        : ""}
                    </Link>
                  ) : null
                }
              />
              <DetailRow
                label="Installments"
                value={
                  property.installmentSummary?.installmentsEnabled
                    ? "Yes"
                    : "No"
                }
              />
              <DetailRow
                label="Monthly installment"
                value={
                  property.installmentSummary?.monthlyInstallmentAmount != null
                    ? formatMoney(
                        property.installmentSummary.monthlyInstallmentAmount
                      )
                    : property.installmentSummary?.installmentPlanName || null
                }
              />
              {property.installmentSummary?.bookingCode ? (
                <DetailRow
                  label="Installment booking"
                  value={
                    <Link
                      to={`/bookings/${property.installmentSummary.bookingId}`}
                      className="linkish"
                    >
                      {property.installmentSummary.bookingCode}
                      {property.installmentSummary.installmentPlanName
                        ? ` · ${property.installmentSummary.installmentPlanName}`
                        : ""}
                    </Link>
                  }
                />
              ) : null}
              {property.purpose === "rent" ||
              property.monthlyRent != null ||
              property.advanceRentMonths != null ||
              property.securityDeposit != null ? (
                <>
                  <DetailRow
                    label="Monthly rent"
                    value={
                      property.monthlyRent != null
                        ? formatMoney(property.monthlyRent)
                        : null
                    }
                  />
                  <DetailRow
                    label="Advance rent"
                    value={
                      property.advanceRentMonths != null
                        ? `${property.advanceRentMonths} month${
                            Number(property.advanceRentMonths) === 1 ? "" : "s"
                          }`
                        : null
                    }
                  />
                  <DetailRow
                    label="Security deposit"
                    value={
                      property.securityDeposit != null
                        ? formatMoney(property.securityDeposit)
                        : null
                    }
                  />
                </>
              ) : null}
              {property.purpose !== "rent" ? (
                <DetailRow
                  label="Asking price"
                  value={
                    property.askingPrice != null
                      ? formatMoney(property.askingPrice)
                      : null
                  }
                />
              ) : null}
            </dl>
            <div className="related-nav" style={{ marginTop: "0.85rem" }}>
              <Link
                to={`/payments?propertyId=${property.id}`}
                className="btn btn--ghost btn--inline"
              >
                Property payments
              </Link>
              <Link
                to={`/reports?tab=payments&propertyId=${property.id}`}
                className="btn btn--ghost btn--inline"
              >
                Payments report
              </Link>
              <Link
                to={`/reports?tab=bookings&propertyId=${property.id}`}
                className="btn btn--ghost btn--inline"
              >
                Bookings report
              </Link>
            </div>
            {banks.length === 0 ? (
              <p className="form-hint">
                Link an owner bank account in Owners &amp; banks below to
                complete listing readiness.
              </p>
            ) : null}
          </section>

          <div id="owners-banks" className="owners-banks-block">
            <div className="detail-card detail-card--intro">
              <div className="detail-card__header-row">
                <h3 className="detail-card__title">Owners &amp; bank accounts</h3>
                <div className="related-nav related-nav--compact">
                  <Link to="/owners/new" className="btn btn--tiny btn--ghost">
                    Add owner
                  </Link>
                  <Link to="/banks/new" className="btn btn--tiny btn--ghost">
                    Add bank
                  </Link>
                </div>
              </div>
              <p className="muted tiny">
                Link verified owners and active bank accounts required for
                listing. Names open the full owner/bank detail pages.
              </p>
            </div>
            <PropertyLinksPanel property={property} onChanged={load} />
          </div>

          <section className="detail-card" id="property-details">
            <h3 className="detail-card__title">Property details</h3>
            <dl className="detail-list detail-list--2">
              <DetailRow
                label="Property age"
                value={
                  property.propertyAgeYears != null
                    ? `${property.propertyAgeYears} years`
                    : null
                }
              />
              <DetailRow label="Year built" value={property.yearBuilt} />
              <DetailRow
                label="Covered area"
                value={
                  property.coveredArea != null
                    ? `${property.coveredArea}${
                        property.areaUnit ? ` ${property.areaUnit}` : ""
                      }`
                    : null
                }
              />
              <DetailRow
                label="Plot size"
                value={
                  property.plotSize != null
                    ? `${property.plotSize}${
                        property.areaUnit ? ` ${property.areaUnit}` : ""
                      }`
                    : null
                }
              />
              <DetailRow
                label="Unit"
                value={
                  property.areaUnit ? formatLabel(property.areaUnit) : null
                }
              />
              <DetailRow label="Floor number" value={property.floorNumber} />
              <DetailRow label="Total floors" value={property.totalFloors} />
              <DetailRow
                label="Facing"
                value={formatLabel(property.facingDirection)}
              />
              <DetailRow
                label="Furnishing"
                value={formatLabel(property.furnishingStatus)}
              />
              <DetailRow
                label="Possession"
                value={formatLabel(property.possessionStatus)}
              />
            </dl>
            {property.renovationHistory ? (
              <div className="detail-description">
                <h4>Renovation history</h4>
                <p>{property.renovationHistory}</p>
              </div>
            ) : null}
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Property features</h3>
            <dl className="detail-list detail-list--2">
              {FEATURE_FLAGS.map(({ key, label }) => (
                <DetailRow
                  key={key}
                  label={label}
                  value={property.features?.[key] ? "Yes" : "No"}
                />
              ))}
              <DetailRow
                label="Lift"
                value={liftCount ? String(liftCount) : "No"}
              />
              <DetailRow
                label="Cargo"
                value={cargoCount ? String(cargoCount) : "No"}
              />
              <DetailRow
                label="Parking capacity"
                value={
                  property.features?.parkingCapacity != null
                    ? property.features.parkingCapacity
                    : null
                }
              />
              <DetailRow
                label="Water supply"
                value={property.features?.waterSupply}
              />
              <DetailRow label="Appliances" value={appliancesDisplay} />
            </dl>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Ownership & legal</h3>
            <dl className="detail-list detail-list--2">
              <DetailRow
                label="Ownership type"
                value={formatLabel(property.ownershipType)}
              />
              <DetailRow
                label="Legal status"
                value={formatLabel(property.legalStatus)}
              />
              <DetailRow
                label="NOC status"
                value={formatLabel(property.nocStatus)}
              />
              <DetailRow
                label="Tax status"
                value={formatLabel(property.propertyTaxStatus)}
              />
              <DetailRow
                label="Mortgage"
                value={formatLabel(property.mortgageStatus)}
              />
            </dl>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Utilities</h3>
            <dl className="detail-list detail-list--2">
              <DetailRow
                label="Electricity meter"
                value={property.utilityMeterElectricity}
              />
              <DetailRow label="Gas meter" value={property.utilityMeterGas} />
              <DetailRow
                label="Water meter"
                value={property.utilityMeterWater}
              />
              <DetailRow
                label="Energy rating"
                value={property.energyRating}
              />
              <DetailRow
                label="Insurance"
                value={property.insuranceDetails}
              />
            </dl>
          </section>

          <PropertyRelatedActivityPanel propertyId={property.id} />

          <div id="history">
            <PropertyHistoryTimeline propertyId={property.id} />
          </div>

          <div id="visits">
            <PropertyVisitsPanel propertyId={property.id} />
          </div>

          <div id="documents">
            <PropertyDocumentsMedia propertyId={property.id} />
          </div>
        </div>

        <div className="detail-side">
          <section className="detail-card">
            <h3 className="detail-card__title">Listing readiness</h3>
            <p className="muted tiny">
              Non-draft statuses require verified owners (100% shares), a bank
              account, and a payment method
              {property.purpose === "rent" ? ", plus rent fields" : ""}.
            </p>
            <div className="status-form">
              <select
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
                disabled={statusSaving}
              >
                {PROPERTY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {formatLabel(s)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn--primary btn--inline"
                disabled={
                  statusSaving ||
                  !statusValue ||
                  statusValue === property.status
                }
                onClick={handleStatusSave}
              >
                {statusSaving ? "Updating…" : "Update status"}
              </button>
            </div>
            {readiness ? (
              <ul className="readiness-list">
                <li className={readiness.hasVerifiedOwner ? "ok" : "missing"}>
                  Verified owner
                </li>
                <li className={readiness.hasBankAccount ? "ok" : "missing"}>
                  Bank account linked
                </li>
                <li className={readiness.hasPaymentMethod ? "ok" : "missing"}>
                  Payment method set
                </li>
                <li
                  className={
                    Number(readiness.ownerShareTotal) === 100 ? "ok" : "missing"
                  }
                >
                  Owner shares = 100% (now {readiness.ownerShareTotal ?? 0}%)
                </li>
                {property.purpose === "rent" ? (
                  <li
                    className={readiness.rentFieldsComplete ? "ok" : "missing"}
                  >
                    Rent fields complete
                  </li>
                ) : null}
                <li className={readiness.canList ? "ok" : "missing"}>
                  Ready to leave draft: {readiness.canList ? "Yes" : "No"}
                </li>
              </ul>
            ) : null}
            <dl className="detail-list" style={{ marginTop: "1rem" }}>
              <DetailRow
                label="Created"
                value={
                  property.createdAt
                    ? new Date(property.createdAt).toLocaleString()
                    : null
                }
              />
              <DetailRow
                label="Updated"
                value={
                  property.updatedAt
                    ? new Date(property.updatedAt).toLocaleString()
                    : null
                }
              />
            </dl>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Linked parties</h3>
            {owners.length === 0 ? (
              <p className="muted tiny">No owners linked yet.</p>
            ) : (
              <ul className="simple-list">
                {owners.map((o) => (
                  <li key={o.id || o.ownerId}>
                    <Link to={`/owners/${o.ownerId}`} className="linkish">
                      {o.ownerName || `Owner #${o.ownerId}`}
                    </Link>
                    <span className="muted">
                      {" "}
                      · {o.sharePercentage}%
                      {o.isPrimary ? " · Primary" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {banks.length === 0 ? (
              <p className="muted tiny">No bank accounts linked yet.</p>
            ) : (
              <ul className="simple-list" style={{ marginTop: "0.65rem" }}>
                {banks.map((b) => (
                  <li key={b.id || b.bankAccountId}>
                    <Link
                      to={`/banks/${b.bankAccountId}`}
                      className="linkish"
                    >
                      {b.bankName || `Bank #${b.bankAccountId}`}
                    </Link>
                    {b.isPrimary ? (
                      <span className="muted"> · Primary</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <a href="#owners-banks" className="btn btn--ghost btn--inline">
              Manage owner &amp; bank links
            </a>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Related records</h3>
            <p className="muted tiny">
              Jump to bookings, payments, commissions, transfers, maintenance,
              and reports for this property.
            </p>
            <div className="related-nav">
              <Link
                to={`/bookings?propertyId=${property.id}`}
                className="btn btn--ghost btn--inline"
              >
                Bookings
              </Link>
              <Link
                to={`/payments?propertyId=${property.id}`}
                className="btn btn--ghost btn--inline"
              >
                Payments
              </Link>
              <Link
                to={`/commissions?propertyId=${property.id}`}
                className="btn btn--ghost btn--inline"
              >
                Commissions
              </Link>
              <Link
                to={`/transfers?propertyId=${property.id}`}
                className="btn btn--ghost btn--inline"
              >
                Transfers
              </Link>
              <Link
                to={`/maintenance?propertyId=${property.id}`}
                className="btn btn--ghost btn--inline"
              >
                Maintenance
              </Link>
              <Link
                to={`/maintenance/new?propertyId=${property.id}`}
                className="btn btn--ghost btn--inline"
              >
                Add maintenance
              </Link>
              <Link
                to={`/reports?tab=properties&propertyId=${property.id}`}
                className="btn btn--ghost btn--inline"
              >
                Property report
              </Link>
              <Link
                to={`/reports?tab=bookings&propertyId=${property.id}`}
                className="btn btn--ghost btn--inline"
              >
                Bookings report
              </Link>
              <Link
                to={`/reports?tab=payments&propertyId=${property.id}`}
                className="btn btn--ghost btn--inline"
              >
                Payments report
              </Link>
            </div>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Commission & brokerage</h3>
            <p className="muted tiny">
              Configure commission for this property or review existing records.
            </p>
            <div className="toolbar-actions" style={{ flexWrap: "wrap" }}>
              <Link
                to={`/commissions?propertyId=${property.id}`}
                className="btn btn--ghost btn--inline"
              >
                View commissions
              </Link>
              <Link
                to={`/commissions/new?propertyId=${property.id}`}
                className="btn btn--primary btn--inline"
              >
                Add commission
              </Link>
            </div>
          </section>

          <section className="detail-card">
            <h3 className="detail-card__title">Resale & transfers</h3>
            <p className="muted tiny">
              Record resale or ownership transfer events. Previous owners are
              snapshotted at creation time.
            </p>
            <div className="toolbar-actions" style={{ flexWrap: "wrap" }}>
              <Link
                to={`/transfers?propertyId=${property.id}`}
                className="btn btn--ghost btn--inline"
              >
                View transfers
              </Link>
              <Link
                to={`/transfers/new?propertyId=${property.id}`}
                className="btn btn--primary btn--inline"
              >
                Record transfer
              </Link>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Archive property?"
        message={`"${property.title}" will be soft-deleted and removed from the active list (recycle bin).`}
        confirmLabel="Archive"
        danger
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
