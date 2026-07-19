const express = require("express");
const cors = require("cors");

const scrapeJobsRouter = require("./routes/scrape-jobs");
const { runJobs } = require("./services/scrapeJobRunner");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/scrape-jobs", scrapeJobsRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  // Start the background runner loop
  runJobs();
});
