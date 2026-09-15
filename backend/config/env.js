/**
 * Load and validate required environment variables.
 * Credentials must never be hardcoded in source files.
 *
 * Local: DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD
 * Vercel/Neon: DATABASE_URL (preferred when set)
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function required(name) {
  const value = process.env[name];
  if (value === undefined || String(value).trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name, fallback = undefined) {
  const value = process.env[name];
  if (value === undefined || String(value).trim() === "") return fallback;
  return String(value).trim();
}

const isVercel = process.env.VERCEL === "1";
const isServerless =
  isVercel ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  process.env.SERVERLESS === "1";

const jwtSecret = required("JWT_SECRET");
if (
  jwtSecret === "change_me_in_phase_2" ||
  jwtSecret === "change_me_to_a_long_random_secret"
) {
  if ((process.env.NODE_ENV || "development") === "production") {
    throw new Error("JWT_SECRET must be set to a strong secret in production");
  }
  console.warn(
    "Warning: JWT_SECRET is still a placeholder. Set a strong secret before production."
  );
}

/**
 * Prefer DATABASE_URL (Neon / hosted Postgres). Fall back to discrete local vars.
 */
function buildDbConfig() {
  const databaseUrl = optional("DATABASE_URL");
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      // Neon and most hosted Postgres require TLS
      ssl: { rejectUnauthorized: false },
    };
  }

  return {
    host: required("DB_HOST"),
    port: Number(process.env.DB_PORT) || 5432,
    database: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
  };
}

/**
 * Comma-separated allowlist. Default keeps local Vite origin.
 * Example production: https://your-app.vercel.app,http://localhost:5173
 */
function buildCorsOrigins() {
  const raw =
    optional("CORS_ORIGIN") ||
    optional("CORS_ORIGINS") ||
    "http://localhost:5173";
  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    origins.push("http://localhost:5173");
  }
  return origins;
}

const corsOrigins = buildCorsOrigins();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  db: buildDbConfig(),
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  },
  /** @deprecated Prefer corsOrigins; kept for backward compatibility */
  corsOrigin: corsOrigins[0],
  corsOrigins,
  isDev: (process.env.NODE_ENV || "development") !== "production",
  isVercel,
  isServerless,
};

module.exports = env;
