const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

const scrapeJobsRouter = require("./routes/scrape-jobs");
const aiRouter = require("./routes/ai");
const { runJobs } = require("./services/scrapeJobRunner");

const app = express();
const frontendOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors(
    frontendOrigins.length
      ? { origin: frontendOrigins, methods: ["GET", "POST", "PATCH", "OPTIONS"] }
      : process.env.NODE_ENV === "production"
        ? { origin: false, methods: ["GET", "POST", "PATCH", "OPTIONS"] }
        : {},
  ),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});
app.use("/api/scrape-jobs", scrapeJobsRouter);
app.use("/api/ai", aiRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend server running on port ${PORT}`);
  // Start the background runner loop
  runJobs();
});
