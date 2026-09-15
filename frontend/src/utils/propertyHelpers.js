export const PROPERTY_STATUSES = [
  "draft",
  "available",
  "reserved",
  "sold",
  "rented",
];

export const PROPERTY_PURPOSES = ["sale", "rent", "booking"];

export const PROPERTY_CATEGORIES = ["residential", "commercial", "land"];

export const AREA_UNITS = ["marla", "kanal", "sqft", "sqyd", "sqm"];

export const FACING_DIRECTIONS = [
  "North",
  "South",
  "East",
  "West",
  "North-East",
  "North-West",
  "South-East",
  "South-West",
  "Corner",
];

export const FURNISHING_STATUSES = [
  "Unfurnished",
  "Semi-Furnished",
  "Furnished",
];

export const POSSESSION_STATUSES = [
  "Ready to Move",
  "Under Construction",
  "On Possession Date",
];

export const OWNERSHIP_TYPES = ["Freehold", "Leasehold"];

export const LEGAL_STATUSES = [
  "Clear Title",
  "Disputed",
  "Under Litigation",
];

export const NOC_STATUSES = ["Approved", "Pending", "Not Required"];

export const PROPERTY_TYPE_OPTIONS = ["Flat", "House", "Plot", "Banglow"];

/** Replaces free-text listing type in Basics. */
export const UNIT_LAYOUT_OPTIONS = [
  "1 Studio",
  "2 Bed Lounge",
  "2 Bed DD",
  "3 Bed DD",
  "4 Bed DD",
];

export const COUNT_1_TO_3 = ["1", "2", "3"];

export const FEATURE_FLAGS = [
  { key: "parking", label: "Parking" },
  { key: "security", label: "Security" },
  { key: "gym", label: "Gym" },
  { key: "pool", label: "Pool" },
  { key: "garden", label: "Garden" },
  { key: "generator", label: "Generator" },
  { key: "solar", label: "Solar" },
];

export const WATER_SUPPLY_OPTIONS = ["1 Time", "2 Times", "24 Hours"];

const FEATURE_META_RE = /^EXF:(\{.*?\})\|/;

export function parseFeatureMeta(appliances) {
  const raw = String(appliances || "");
  const match = raw.match(FEATURE_META_RE);
  if (!match) {
    return { liftCount: "", cargoCount: "", appliances: raw };
  }
  let meta = {};
  try {
    meta = JSON.parse(match[1]) || {};
  } catch {
    meta = {};
  }
  return {
    liftCount:
      meta.l != null && meta.l !== "" ? String(meta.l) : "",
    cargoCount:
      meta.c != null && meta.c !== "" ? String(meta.c) : "",
    appliances: raw.slice(match[0].length),
  };
}

export function encodeFeatureMeta({ liftCount, cargoCount, appliances }) {
  const notes = String(appliances || "").replace(FEATURE_META_RE, "").trim();
  const l =
    liftCount !== undefined &&
    liftCount !== null &&
    String(liftCount).trim() !== ""
      ? Number(liftCount)
      : null;
  const c =
    cargoCount !== undefined &&
    cargoCount !== null &&
    String(cargoCount).trim() !== ""
      ? Number(cargoCount)
      : null;
  if (l == null && c == null) return notes || null;
  return `EXF:${JSON.stringify({ l, c })}|${notes}`;
}

export function emptyFeaturesForm() {
  return {
    parking: false,
    parkingCapacity: "",
    security: false,
    lift: false,
    liftCount: "",
    cargoCount: "",
    gym: false,
    pool: false,
    garden: false,
    generator: false,
    solar: false,
    waterSupply: "",
    appliances: "",
  };
}

export function formatLabel(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function locationLabel(property) {
  if (!property) return "—";
  const parts = [property.area, property.society, property.city].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export function priceLabel(property, formatMoney) {
  if (!property) return "—";
  if (property.purpose === "rent") {
    return property.monthlyRent != null
      ? `${formatMoney(property.monthlyRent)} / mo`
      : "—";
  }
  return property.askingPrice != null ? formatMoney(property.askingPrice) : "—";
}

/** Map API validation details array/object into field -> message. */
export function mapApiFieldErrors(details) {
  const mapped = {};
  if (Array.isArray(details)) {
    for (const item of details) {
      if (item?.field) mapped[item.field] = item.message || "Invalid value";
    }
  }
  return mapped;
}

export function emptyPropertyForm() {
  return {
    title: "",
    propertyCode: "",
    purpose: "sale",
    category: "residential",
    propertyType: "",
    description: "",
    city: "",
    area: "",
    society: "",
    block: "",
    street: "",
    flatOrPlotNumber: "",
    floor: "",
    askingPrice: "",
    monthlyRent: "",
    advanceRentMonths: "",
    securityDeposit: "",
    yearBuilt: "",
    propertyAgeYears: "",
    coveredArea: "",
    plotSize: "",
    areaUnit: "",
    floorNumber: "",
    totalFloors: "",
    facingDirection: "",
    furnishingStatus: "",
    possessionStatus: "",
    ownershipType: "",
    legalStatus: "",
    nocStatus: "",
    utilityMeterElectricity: "",
    utilityMeterGas: "",
    utilityMeterWater: "",
    listingType: "",
    primaryPaymentMethodId: "",
    primaryBankAccountId: "",
    googleMapsUrl: "",
    nearbyLandmarks: "",
    features: emptyFeaturesForm(),
  };
}

export function propertyToFormValues(property) {
  const base = emptyPropertyForm();
  if (!property) return base;
  const f = property.features || {};
  return {
    ...base,
    title: property.title ?? "",
    propertyCode: property.propertyCode ?? "",
    purpose: property.purpose ?? "sale",
    category: property.category ?? "residential",
    propertyType: property.propertyType ?? "",
    description: property.description ?? "",
    city: property.city ?? "",
    area: property.area ?? "",
    society: property.society ?? "",
    block: property.block ?? "",
    street: property.street ?? "",
    flatOrPlotNumber: property.flatOrPlotNumber ?? "",
    floor: property.floor ?? "",
    askingPrice: property.askingPrice ?? "",
    monthlyRent: property.monthlyRent ?? "",
    advanceRentMonths: property.advanceRentMonths ?? "",
    securityDeposit: property.securityDeposit ?? "",
    yearBuilt: property.yearBuilt ?? "",
    propertyAgeYears: property.propertyAgeYears ?? "",
    coveredArea: property.coveredArea ?? "",
    plotSize: property.plotSize ?? "",
    areaUnit: property.areaUnit ?? "",
    floorNumber: property.floorNumber ?? "",
    totalFloors: property.totalFloors ?? "",
    facingDirection: property.facingDirection ?? "",
    furnishingStatus: property.furnishingStatus ?? "",
    possessionStatus: property.possessionStatus ?? "",
    ownershipType: property.ownershipType ?? "",
    legalStatus: property.legalStatus ?? "",
    nocStatus: property.nocStatus ?? "",
    utilityMeterElectricity: property.utilityMeterElectricity ?? "",
    utilityMeterGas: property.utilityMeterGas ?? "",
    utilityMeterWater: property.utilityMeterWater ?? "",
    listingType: property.listingType ?? "",
    primaryPaymentMethodId:
      property.primaryPaymentMethodId != null
        ? String(property.primaryPaymentMethodId)
        : "",
    primaryBankAccountId: (() => {
      const banks = property.bankAccounts || [];
      const primary =
        banks.find((b) => b.isPrimary) || banks[0] || null;
      return primary?.bankAccountId != null
        ? String(primary.bankAccountId)
        : "";
    })(),
    googleMapsUrl: property.googleMapsUrl ?? "",
    nearbyLandmarks: property.nearbyLandmarks ?? "",
    features: (() => {
      const meta = parseFeatureMeta(f.appliances);
      const liftCount =
        f.liftCount != null && String(f.liftCount).trim() !== ""
          ? String(f.liftCount)
          : meta.liftCount || (f.lift ? "1" : "");
      const cargoCount =
        f.cargoCount != null && String(f.cargoCount).trim() !== ""
          ? String(f.cargoCount)
          : meta.cargoCount;
      return {
        parking: Boolean(f.parking),
        parkingCapacity:
          f.parkingCapacity != null ? String(f.parkingCapacity) : "",
        security: Boolean(f.security),
        lift: Boolean(f.lift) || Boolean(liftCount),
        liftCount,
        cargoCount,
        gym: Boolean(f.gym),
        pool: Boolean(f.pool),
        garden: Boolean(f.garden),
        generator: Boolean(f.generator),
        solar: Boolean(f.solar),
        waterSupply: f.waterSupply ?? "",
        appliances: meta.appliances ?? "",
      };
    })(),
  };
}

/** Build create/update payload; omit empty optional strings. */
export function buildPropertyPayload(values) {
  const payload = {
    title: String(values.title || "").trim(),
    purpose: values.purpose,
    category: values.category,
  };

  const optionalStrings = [
    "propertyCode",
    "propertyType",
    "description",
    "city",
    "area",
    "society",
    "block",
    "street",
    "flatOrPlotNumber",
    "floor",
    "areaUnit",
    "facingDirection",
    "furnishingStatus",
    "possessionStatus",
    "ownershipType",
    "legalStatus",
    "nocStatus",
    "utilityMeterElectricity",
    "utilityMeterGas",
    "utilityMeterWater",
    "listingType",
    "googleMapsUrl",
    "nearbyLandmarks",
  ];

  for (const key of optionalStrings) {
    const raw = values[key];
    if (raw === undefined || raw === null) continue;
    const trimmed = String(raw).trim();
    if (trimmed !== "") payload[key] = trimmed;
  }

  const optionalNumbers = [
    "askingPrice",
    "monthlyRent",
    "advanceRentMonths",
    "securityDeposit",
    "yearBuilt",
    "propertyAgeYears",
    "coveredArea",
    "plotSize",
    "floorNumber",
    "totalFloors",
  ];

  for (const key of optionalNumbers) {
    const raw = values[key];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    const num = Number(raw);
    if (!Number.isNaN(num)) payload[key] = num;
  }

  if (
    values.primaryPaymentMethodId !== undefined &&
    values.primaryPaymentMethodId !== null &&
    String(values.primaryPaymentMethodId).trim() !== ""
  ) {
    payload.primaryPaymentMethodId = Number(values.primaryPaymentMethodId);
  }

  if (values.purpose === "rent") {
    if (String(values.monthlyRent).trim() !== "") {
      payload.monthlyRent = Number(values.monthlyRent);
    }
    if (String(values.advanceRentMonths).trim() !== "") {
      payload.advanceRentMonths = Number(values.advanceRentMonths);
    }
    if (String(values.securityDeposit).trim() !== "") {
      payload.securityDeposit = Number(values.securityDeposit);
    }
  }

  const f = values.features || emptyFeaturesForm();
  const liftCountRaw = String(f.liftCount || "").trim();
  const cargoCountRaw = String(f.cargoCount || "").trim();
  const liftCount = liftCountRaw === "" ? null : Number(liftCountRaw);
  const cargoCount = cargoCountRaw === "" ? null : Number(cargoCountRaw);
  payload.features = {
    parking: Boolean(f.parking),
    security: Boolean(f.security),
    lift: liftCount != null && liftCount > 0,
    liftCount,
    cargoCount,
    gym: Boolean(f.gym),
    pool: Boolean(f.pool),
    garden: Boolean(f.garden),
    generator: Boolean(f.generator),
    solar: Boolean(f.solar),
    parkingCapacity:
      String(f.parkingCapacity || "").trim() === ""
        ? null
        : Number(f.parkingCapacity),
    waterSupply: String(f.waterSupply || "").trim() || null,
    appliances: encodeFeatureMeta({
      liftCount,
      cargoCount,
      appliances: f.appliances,
    }),
  };

  return payload;
}

export function validatePropertyForm(values, { mode }) {
  const errors = {};
  const title = String(values.title || "").trim();
  if (!title) errors.title = "Title is required";
  else if (title.length > 200) errors.title = "Title must be at most 200 characters";

  if (!PROPERTY_PURPOSES.includes(values.purpose)) {
    errors.purpose = "Purpose is required";
  }
  if (!PROPERTY_CATEGORIES.includes(values.category)) {
    errors.category = "Category is required";
  }

  if (values.purpose === "rent" && mode === "create") {
    if (String(values.monthlyRent).trim() === "") {
      errors.monthlyRent = "Monthly rent is required for rent purpose";
    }
    if (String(values.advanceRentMonths).trim() === "") {
      errors.advanceRentMonths = "Advance rent months is required for rent purpose";
    }
    if (String(values.securityDeposit).trim() === "") {
      errors.securityDeposit = "Security deposit is required for rent purpose";
    }
  }

  const numberFields = [
    "askingPrice",
    "monthlyRent",
    "advanceRentMonths",
    "securityDeposit",
    "yearBuilt",
    "propertyAgeYears",
    "coveredArea",
    "plotSize",
    "floorNumber",
    "totalFloors",
  ];
  for (const key of numberFields) {
    const raw = values[key];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    const num = Number(raw);
    if (Number.isNaN(num) || num < 0) {
      errors[key] = "Must be a non-negative number";
    }
  }

  if (String(values.yearBuilt || "").trim() !== "") {
    const year = Number(values.yearBuilt);
    const current = new Date().getFullYear();
    if (!Number.isInteger(year) || year < 1800 || year > current + 5) {
      errors.yearBuilt = `Year built must be between 1800 and ${current + 5}`;
    }
  }

  const capacity = values.features?.parkingCapacity;
  if (capacity !== undefined && capacity !== null && String(capacity).trim() !== "") {
    const num = Number(capacity);
    if (Number.isNaN(num) || num < 0 || !Number.isInteger(num)) {
      errors.parkingCapacity = "Must be a non-negative integer";
    }
  }

  for (const key of ["liftCount", "cargoCount"]) {
    const raw = values.features?.[key];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    const num = Number(raw);
    if (!Number.isInteger(num) || num < 1 || num > 3) {
      errors[key] = "Must be 1, 2, or 3";
    }
  }

  return errors;
}
