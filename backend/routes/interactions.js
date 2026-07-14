const express = require('express');
const db = require('../database');

const router = express.Router({ mergeParams: true });

router.get('/', (req, res) => {
  const interactions = db.prepare('SELECT * FROM interactions WHERE lead_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(interactions);
});

router.post('/', (req, res) => {
  const { type, notes } = req.body;
  const leadId = req.params.id;
  
  db.prepare('INSERT INTO interactions (lead_id, type, notes) VALUES (?, ?, ?)').run(leadId, type, notes);
  
  res.json({ success: true });
});

module.exports = router;
