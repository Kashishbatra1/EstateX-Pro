/**
 * HTTP server entry point (local / long-running process).
 * Vercel does not use this file — see api/index.js.
 */
const app = require("./app");
const env = require("./config/env");
const { startReminderScheduler } = require("./utils/reminderScheduler");

const server = app.listen(env.port, () => {
  console.log(`EstateX Pro server running on http://localhost:${env.port}`);
  console.log(`Environment: ${env.nodeEnv}`);
  // Reminder scheduler needs a persistent process — skip on Vercel/serverless
  if (env.isServerless) {
    console.log("Reminder scheduler skipped (serverless environment).");
    return;
  }
  try {
    startReminderScheduler();
  } catch (err) {
    console.error("Reminder scheduler failed to start:", err.message);
  }
});

server.on("error", (err) => {
  console.error("Server failed to start:", err.message);
  process.exit(1);
});

module.exports = server;
