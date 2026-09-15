/**
 * Map between API (camelCase) and PostgreSQL properties columns.
 */
const STATUS_VALUES = ["draft", "available", "sold", "rented", "reserved"];
const PURPOSE_VALUES = ["sale", "rent", "booking"];
const CATEGORY_VALUES = ["residential", "commercial", "land"];

const FEATURE_BOOLEAN_FIELDS = [
  "parking",
  "security",
  "lift",
  "gym",
  "pool",
  "garden",
  "generator",
  "solar",
];

const WATER_SUPPLY_OPTIONS = ["1 Time", "2 Times", "24 Hours"];

const FEATURE_META_RE = /^EXF:(\{.*?\})\|/;

function parseFeatureMeta(appliances) {
  const raw = appliances == null ? "" : String(appliances);
  const match = raw.match(FEATURE_META_RE);
  if (!match) {
    return { liftCount: null, cargoCount: null, appliances: raw || null };
  }
  let meta = {};
  try {
    meta = JSON.parse(match[1]) || {};
  } catch {
    meta = {};
  }
  const notes = raw.slice(match[0].length);
  return {
    liftCount:
      meta.l !== null && meta.l !== undefined && meta.l !== ""
        ? Number(meta.l)
        : null,
    cargoCount:
      meta.c !== null && meta.c !== undefined && meta.c !== ""
        ? Number(meta.c)
        : null,
    appliances: notes === "" ? null : notes,
  };
}

function encodeFeatureMeta({ liftCount, cargoCount, appliances }) {
  const notes = String(appliances || "")
    .replace(FEATURE_META_RE, "")
    .trim();
  const l =
    liftCount !== undefined &&
    liftCount !== null &&
    String(liftCount).trim() !== "" &&
    !Number.isNaN(Number(liftCount))
      ? Number(liftCount)
      : null;
  const c =
    cargoCount !== undefined &&
    cargoCount !== null &&
    String(cargoCount).trim() !== "" &&
    !Number.isNaN(Number(cargoCount))
      ? Number(cargoCount)
      : null;
  if (l == null && c == null) return notes || null;
  return `EXF:${JSON.stringify({ l, c })}|${notes}`;
}

const WRITABLE_FIELDS = {
  title: "title",
  propertyType: "property_type",
  purpose: "purpose",
  category: "category",
  description: "description",
  city: "city",
  area: "area",
  society: "society",
  block: "block",
  floor: "floor",
  street: "street",
  flatOrPlotNumber: "flat_or_plot_number",
  googleMapsUrl: "google_maps_url",
  latitude: "latitude",
  longitude: "longitude",
  yearBuilt: "year_built",
  propertyAgeYears: "property_age_years",
  coveredArea: "covered_area",
  plotSize: "plot_size",
  areaUnit: "area_unit",
  floorNumber: "floor_number",
  totalFloors: "total_floors",
  facingDirection: "facing_direction",
  furnishingStatus: "furnishing_status",
  possessionStatus: "possession_status",
  ownershipType: "ownership_type",
  legalStatus: "legal_status",
  nocStatus: "noc_status",
  utilityMeterElectricity: "utility_meter_electricity",
  utilityMeterGas: "utility_meter_gas",
  utilityMeterWater: "utility_meter_water",
  propertyTaxStatus: "property_tax_status",
  mortgageStatus: "mortgage_status",
  nearbyLandmarks: "nearby_landmarks",
  videoWalkthroughUrl: "video_walkthrough_url",
  listingType: "listing_type",
  isFeatured: "is_featured",
  propertyRating: "property_rating",
  renovationHistory: "renovation_history",
  energyRating: "energy_rating",
  insuranceDetails: "insurance_details",
  askingPrice: "asking_price",
  monthlyRent: "monthly_rent",
  advanceRentMonths: "advance_rent_months",
  securityDeposit: "security_deposit",
  primaryPaymentMethodId: "primary_payment_method_id",
  propertyCode: "property_code",
};

function emptyFeatures() {
  return {
    parking: false,
    parkingCapacity: null,
    security: false,
    lift: false,
    liftCount: null,
    cargoCount: null,
    gym: false,
    pool: false,
    garden: false,
    generator: false,
    solar: false,
    waterSupply: null,
    appliances: null,
  };
}

function toPublicFeatures(row) {
  if (!row) return emptyFeatures();
  const meta = parseFeatureMeta(row.appliances);
  const liftCount =
    meta.liftCount != null
      ? meta.liftCount
      : row.lift
        ? 1
        : null;
  return {
    parking: Boolean(row.parking),
    parkingCapacity:
      row.parking_capacity !== null && row.parking_capacity !== undefined
        ? Number(row.parking_capacity)
        : null,
    security: Boolean(row.security),
    lift: Boolean(row.lift) || Boolean(liftCount),
    liftCount,
    cargoCount: meta.cargoCount,
    gym: Boolean(row.gym),
    pool: Boolean(row.pool),
    garden: Boolean(row.garden),
    generator: Boolean(row.generator),
    solar: Boolean(row.solar),
    waterSupply: row.water_supply || null,
    appliances: meta.appliances,
  };
}

/** Normalize features payload from create/update body. Returns null if absent. */
function normalizeFeaturesInput(input) {
  if (!input || typeof input !== "object") return null;
  const src =
    input.features && typeof input.features === "object"
      ? input.features
      : null;
  if (!src) return null;

  const out = {};
  for (const key of FEATURE_BOOLEAN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(src, key)) {
      out[key] = Boolean(src[key]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(src, "parkingCapacity")) {
    const raw = src.parkingCapacity;
    if (raw === "" || raw === null || raw === undefined) {
      out.parkingCapacity = null;
    } else {
      out.parkingCapacity = Number(raw);
    }
  }

  if (Object.prototype.hasOwnProperty.call(src, "waterSupply")) {
    const trimmed = String(src.waterSupply || "").trim();
    out.waterSupply = trimmed === "" ? null : trimmed;
  }

  const hasLiftCount = Object.prototype.hasOwnProperty.call(src, "liftCount");
  const hasCargoCount = Object.prototype.hasOwnProperty.call(src, "cargoCount");
  const hasAppliances = Object.prototype.hasOwnProperty.call(src, "appliances");

  if (hasLiftCount || hasCargoCount || hasAppliances) {
    const currentMeta = parseFeatureMeta(
      hasAppliances ? src.appliances : null
    );
    const liftCount = hasLiftCount
      ? src.liftCount === "" || src.liftCount === null || src.liftCount === undefined
        ? null
        : Number(src.liftCount)
      : currentMeta.liftCount;
    const cargoCount = hasCargoCount
      ? src.cargoCount === "" ||
        src.cargoCount === null ||
        src.cargoCount === undefined
        ? null
        : Number(src.cargoCount)
      : currentMeta.cargoCount;
    const notes = hasAppliances
      ? parseFeatureMeta(src.appliances).appliances
      : currentMeta.appliances;

    out.lift = liftCount != null && Number(liftCount) > 0;
    out.appliances = encodeFeatureMeta({
      liftCount,
      cargoCount,
      appliances: notes,
    });
  } else if (Object.prototype.hasOwnProperty.call(src, "appliances")) {
    const trimmed = String(src.appliances || "").trim();
    out.appliances = trimmed === "" ? null : trimmed;
  }

  return out;
}

function toPublicProperty(row, extras = {}) {
  if (!row) return null;
  return {
    id: Number(row.id),
    propertyCode: row.property_code,
    title: row.title,
    propertyType: row.property_type,
    purpose: row.purpose,
    category: row.category,
    status: row.status,
    description: row.description,
    city: row.city,
    area: row.area,
    society: row.society,
    block: row.block,
    floor: row.floor,
    street: row.street,
    flatOrPlotNumber: row.flat_or_plot_number,
    googleMapsUrl: row.google_maps_url,
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
    yearBuilt: row.year_built,
    propertyAgeYears: row.property_age_years,
    coveredArea: row.covered_area !== null ? Number(row.covered_area) : null,
    plotSize: row.plot_size !== null ? Number(row.plot_size) : null,
    areaUnit: row.area_unit,
    floorNumber: row.floor_number,
    totalFloors: row.total_floors,
    facingDirection: row.facing_direction,
    furnishingStatus: row.furnishing_status,
    possessionStatus: row.possession_status,
    ownershipType: row.ownership_type,
    legalStatus: row.legal_status,
    nocStatus: row.noc_status,
    utilityMeterElectricity: row.utility_meter_electricity,
    utilityMeterGas: row.utility_meter_gas,
    utilityMeterWater: row.utility_meter_water,
    propertyTaxStatus: row.property_tax_status,
    mortgageStatus: row.mortgage_status,
    nearbyLandmarks: row.nearby_landmarks,
    videoWalkthroughUrl: row.video_walkthrough_url,
    listingType: row.listing_type,
    isFeatured: row.is_featured,
    propertyRating: row.property_rating !== null ? Number(row.property_rating) : null,
    renovationHistory: row.renovation_history,
    energyRating: row.energy_rating,
    insuranceDetails: row.insurance_details,
    askingPrice: row.asking_price !== null ? Number(row.asking_price) : null,
    monthlyRent: row.monthly_rent !== null ? Number(row.monthly_rent) : null,
    advanceRentMonths: row.advance_rent_months,
    securityDeposit:
      row.security_deposit !== null ? Number(row.security_deposit) : null,
    primaryPaymentMethodId: row.primary_payment_method_id
      ? Number(row.primary_payment_method_id)
      : null,
    createdBy: row.created_by ? Number(row.created_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    ...extras,
  };
}

module.exports = {
  STATUS_VALUES,
  PURPOSE_VALUES,
  CATEGORY_VALUES,
  WRITABLE_FIELDS,
  FEATURE_BOOLEAN_FIELDS,
  WATER_SUPPLY_OPTIONS,
  emptyFeatures,
  toPublicFeatures,
  normalizeFeaturesInput,
  toPublicProperty,
};
