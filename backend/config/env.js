/**
 * Load and validate required environment variables.
 * Credentials must never be hardcoded in source files.
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

const jwtSecret = required("JWT_SECRET");
if (jwtSecret === "change_me_in_phase_2" || jwtSecret === "change_me_to_a_long_random_secret") {
  if ((process.env.NODE_ENV || "development") === "production") {
    throw new Error("JWT_SECRET must be set to a strong secret in production");
  }
  console.warn("Warning: JWT_SECRET is still a placeholder. Set a strong secret before production.");
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  db: {
    host: required("DB_HOST"),
    port: Number(process.env.DB_PORT) || 5432,
    name: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  },
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  isDev: (process.env.NODE_ENV || "development") !== "production",
};

module.exports = env;
