const app = require("./app");
const env = require("./config/env");
const { startReminderScheduler } = require("./utils/reminderScheduler");

const isServerlessRuntime =
  Boolean(env.isServerless) || process.env.VERCEL === "1";

if (isServerlessRuntime) {
  // Vercel/serverless: export Express app only.
  // Never call listen(), start scheduler, or process.exit().
  module.exports = app;
} else {
  // Local long-running server: preserve npm start behavior.
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
}
