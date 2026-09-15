/**
 * Express application setup.
 * Phase 2: Authentication & authorization wired under /api/auth.
 * Phase 12: CORS enabled for the frontend origin from env.
 */
const express = require("express");
const env = require("./config/env");
const routes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const origin = env.corsOrigin || "http://localhost:5173";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Disposition, Content-Type"
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

app.use("/api", routes);

// Keep root health message for backward compatibility with earlier setup
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "EstateX Pro Backend is running!",
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
