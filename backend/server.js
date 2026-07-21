const express = require("express");
const cors = require("cors");

const scrapeJobsRouter = require("./routes/scrape-jobs");
const { runJobs } = require("./services/scrapeJobRunner");

const app = express();
const frontendOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors(
    frontendOrigins.length
      ? { origin: frontendOrigins, methods: ["GET", "POST", "OPTIONS"] }
      : {},
  ),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});
app.use("/api/scrape-jobs", scrapeJobsRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend server running on port ${PORT}`);
  // Start the background runner loop
  runJobs();
});
