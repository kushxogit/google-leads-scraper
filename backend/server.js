const express = require('express');
const cors = require('cors');

const leadsRouter = require('./routes/leads');
const scrapeJobsRouter = require('./routes/scrape-jobs');
const interactionsRouter = require('./routes/interactions');
const { runJobs } = require('./services/scrapeJobRunner');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/leads/:id/interactions', interactionsRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/scrape-jobs', scrapeJobsRouter);

// Delete a lead
app.delete('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM interactions WHERE lead_id = ?').run(id);
    db.prepare('DELETE FROM leads WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  // Start the background runner loop
  runJobs();
});
