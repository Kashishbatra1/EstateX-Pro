/**
 * Vercel serverless entry point.
 * Exports the Express app without calling listen().
 * Local development continues to use: npm start → server.js
 */
module.exports = require("../app");
