/**
 * Lightweight reminder scheduler — no external cron dependency.
 * Failures never prevent server startup.
 */
const notificationService = require("../services/notification.service");

const INTERVAL_MS = Number(process.env.REMINDER_INTERVAL_MS) || 60 * 60 * 1000; // 1 hour
let timer = null;

async function runOnce() {
  try {
    const result = await notificationService.processReminders();
    if (result.createdCount > 0) {
      console.log(`[reminders] created ${result.createdCount} notification(s)`);
    }
  } catch (err) {
    console.error("[reminders] processing failed:", err.message);
  }
}

function startReminderScheduler() {
  if (timer) return;
  // Delay first run so DB pool / server settle; do not block listen()
  setTimeout(() => {
    runOnce();
    timer = setInterval(runOnce, INTERVAL_MS);
    if (typeof timer.unref === "function") timer.unref();
  }, 5000);
}

function stopReminderScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  startReminderScheduler,
  stopReminderScheduler,
  runOnce,
};
