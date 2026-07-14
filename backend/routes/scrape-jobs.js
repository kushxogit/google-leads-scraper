const express = require('express');
const db = require('../database');
const { runJobs } = require('../services/scrapeJobRunner');

const router = express.Router();

router.get('/', (req, res) => {
  const jobs = db.prepare('SELECT * FROM scrape_jobs ORDER BY created_at DESC').all();
  res.json(jobs);
});

router.post('/', (req, res) => {
  const { query, niche, area, source, limit, headless } = req.body;
  
  const insert = db.prepare(`
    INSERT INTO scrape_jobs (query, niche, area, source, lead_limit, headless) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const niches = niche ? niche.split(',').map(n => n.trim()).filter(Boolean) : [''];
  const areas = area ? area.split(',').map(a => a.trim()).filter(Boolean) : [''];
  const queries = query ? query.split(',').map(q => q.trim()).filter(Boolean) : [];

  let jobsInserted = 0;
  let firstJobId = null;

  db.transaction(() => {
    // If they provided queries but no niche/area, just iterate queries
    if (queries.length > 0 && niches.length === 1 && areas.length === 1 && niches[0] === '' && areas[0] === '') {
      for (const q of queries) {
        const result = insert.run(q, '', '', source || 'Google Maps', limit || 50, headless ? 1 : 0);
        if (!firstJobId) firstJobId = result.lastInsertRowid;
        jobsInserted++;
      }
    } else {
      // Cartesian product of niches and areas
      for (const currentNiche of niches) {
        for (const currentArea of areas) {
          // If query was provided, use the first one (or construct dynamic if multiple? Usually dynamic is better)
          // To be safe, if there's no specific query or we're doing combinations, construct it:
          const dynamicQuery = `${currentNiche} in ${currentArea}`.trim();
          const finalQuery = queries.length === 1 && niches.length === 1 && areas.length === 1 
            ? queries[0] 
            : dynamicQuery;

          const result = insert.run(
            finalQuery, 
            currentNiche, 
            currentArea, 
            source || 'Google Maps', 
            limit || 50, 
            headless ? 1 : 0
          );
          if (!firstJobId) firstJobId = result.lastInsertRowid;
          jobsInserted++;
        }
      }
    }
  })();
  
  // Kick off runner if not running
  runJobs();
  
  res.json({ success: true, jobId: firstJobId, jobsInserted });
});

router.get('/:id', (req, res) => {
  const job = db.prepare('SELECT * FROM scrape_jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  res.json(job);
});

module.exports = router;
