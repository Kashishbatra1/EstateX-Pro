/**
 * HTTP server entry point.
 */
const app = require("./app");
const env = require("./config/env");
const { startReminderScheduler } = require("./utils/reminderScheduler");

const server = app.listen(env.port, () => {
  console.log(`EstateX Pro server running on http://localhost:${env.port}`);
  console.log(`Environment: ${env.nodeEnv}`);
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
