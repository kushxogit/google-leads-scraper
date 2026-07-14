const db = require('../database');

function isDuplicate(lead) {
  // Check by Phone
  if (lead.phone) {
    const byPhone = db.prepare('SELECT id FROM leads WHERE phone = ?').get(lead.phone);
    if (byPhone) return true;
  }

  // Check by Website
  if (lead.website && lead.website !== 'N/A') {
    const byWebsite = db.prepare('SELECT id FROM leads WHERE website = ?').get(lead.website);
    if (byWebsite) return true;
  }

  // Check by Business Name and Area
  if (lead.businessName && lead.area && typeof lead.businessName === 'string' && typeof lead.area === 'string') {
    const byNameAndArea = db.prepare('SELECT id FROM leads WHERE LOWER(business_name) = ? AND LOWER(area) = ?').get(lead.businessName.toLowerCase(), lead.area.toLowerCase());
    if (byNameAndArea) return true;
  }

  // Check by Source URL
  if (lead.sourceUrl) {
    const bySourceUrl = db.prepare('SELECT id FROM leads WHERE source_url = ?').get(lead.sourceUrl);
    if (bySourceUrl) return true;
  }

  return false;
}

module.exports = { isDuplicate };
