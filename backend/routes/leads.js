const express = require('express');
const db = require('../database');
const { generateTemplates } = require('../services/templateGenerator');

const router = express.Router();

router.get('/', (req, res) => {
  const leads = db.prepare('SELECT * FROM leads ORDER BY score DESC, created_at DESC').all();
  res.json(leads);
});

router.get('/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  const highPriority = db.prepare('SELECT COUNT(*) as c FROM leads WHERE score >= 70').get().c;
  const noWebsite = db.prepare("SELECT COUNT(*) as c FROM leads WHERE website = 'N/A' OR website = ''").get().c;
  const called = db.prepare('SELECT COUNT(*) as c FROM leads WHERE called = 1').get().c;
  const interested = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'interested'").get().c;
  
  const today = new Date().toISOString().split('T')[0];
  const followUps = db.prepare("SELECT COUNT(*) as c FROM leads WHERE follow_up_date <= ? AND status NOT IN ('won', 'lost', 'do_not_contact')").get(today).c;
  
  const proposalsSent = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'proposal_sent'").get().c;
  const wonDeals = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'won'").get().c;

  res.json({ total, highPriority, noWebsite, called, interested, followUps, proposalsSent, wonDeals });
});

router.get('/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  
  lead.templates = generateTemplates(lead);
  res.json(lead);
});

router.patch('/:id', (req, res) => {
  const allowedFields = ['phone', 'email', 'website', 'status', 'called', 'follow_up_date', 'remarks'];
  const updates = [];
  const params = [];
  
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  if (updates.length === 0) return res.json({ success: true });

  params.push(req.params.id);
  
  db.prepare(`UPDATE leads SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
  
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM interactions WHERE lead_id = ?').run(req.params.id);
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/import', (req, res) => {
  const leadsToImport = req.body.leads;
  if (!Array.isArray(leadsToImport)) {
    return res.status(400).json({ error: 'Expected an array of leads' });
  }

  const { normalizeLead } = require('../services/leadNormalizer');
  const { isDuplicate } = require('../services/duplicateChecker');
  const { scoreLead } = require('../services/leadScorer');
  const { generateRecommendedOffer } = require('../services/recommendedOfferGenerator');

  let importedCount = 0;
  let duplicateCount = 0;

  const insertStmt = db.prepare(`
    INSERT INTO leads (
      business_name, niche, area, phone, email, website, address,
      rating, reviews, source, source_url, score, score_breakdown, recommended_offer
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const raw of leadsToImport) {
      const normalized = normalizeLead(raw);
      if (isDuplicate(normalized)) {
        duplicateCount++;
        continue;
      }
      const { score, scoreBreakdown } = scoreLead(normalized);
      const recommendedOffer = generateRecommendedOffer(normalized);
      
      insertStmt.run(
        normalized.businessName,
        normalized.niche,
        normalized.area,
        normalized.phone,
        normalized.email,
        normalized.website,
        normalized.address,
        normalized.rating,
        normalized.reviews,
        normalized.source || 'Manual Import',
        normalized.sourceUrl,
        score,
        scoreBreakdown,
        recommendedOffer
      );
      importedCount++;
    }
  })();

  res.json({ success: true, importedCount, duplicateCount });
});

module.exports = router;
