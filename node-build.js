"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const app = (0, index_1.createServer)();
const port = process.env.PORT || 8000;
// In development, frontend runs separately on port 3000
// Static file serving is only needed in production
// Uncomment below for production builds:
/*
const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");
app.use(express.static(distPath));

// Handle React Router - serve index.html for all non-API routes
app.get("/*", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(distPath, "index.html"));
});
*/
app.listen(port, () => {
    console.log(`🚀 Backend server running on port ${port}`);
    console.log(`🔧 API: http://localhost:${port}/api`);
    console.log(`📱 Frontend should connect to: http://localhost:3000`);
});
// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("🛑 Received SIGTERM, shutting down gracefully");
    process.exit(0);
});
process.on("SIGINT", () => {
    console.log("🛑 Received SIGINT, shutting down gracefully");
    process.exit(0);
});
