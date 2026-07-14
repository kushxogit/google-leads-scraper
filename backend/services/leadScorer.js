const HIGH_VALUE_NICHES = [
  'dentist', 'clinic', 'doctor', 'salon', 'spa', 'gym', 'real estate',
  'coaching', 'institute', 'lawyer', 'architect', 'interior designer',
  'school', 'restaurant', 'cafe', 'travel agency', 'event planner',
  'photographer', 'car repair', 'pest control', 'packers and movers'
];

function scoreLead(lead) {
  let score = 40;
  let breakdown = [];

  breakdown.push('Base score: 40');

  if (!lead.website || lead.website === 'N/A' || lead.website === '') {
    score += 30;
    breakdown.push('+30 no website');
  } else {
    score -= 5;
    breakdown.push('-5 website exists');
  }

  if (lead.phone) {
    score += 15;
    breakdown.push('+15 phone available');
  }

  if (lead.email) {
    score += 8;
    breakdown.push('+8 email available');
  }

  if (lead.rating && lead.rating >= 4.3) {
    score += 8;
    breakdown.push('+8 rating >= 4.3');
  }

  if (lead.reviews && lead.reviews >= 50) {
    score += 8;
    breakdown.push('+8 50+ reviews');
    if (lead.reviews >= 100) {
      score += 5;
      breakdown.push('+5 100+ reviews');
    }
  }

  const isHighValue = HIGH_VALUE_NICHES.some(nicheType => 
    lead.niche && typeof lead.niche === 'string' && lead.niche.toLowerCase().includes(nicheType)
  );

  if (isHighValue) {
    score += 12;
    breakdown.push('+12 high-value niche');
  }

  if (lead.called) {
    score -= 10;
    breakdown.push('-10 already called');
  }

  if (lead.status === 'lost' || lead.status === 'rejected') {
    score -= 30;
    breakdown.push('-30 status is lost/rejected');
  } else if (lead.status === 'interested') {
    score += 20;
    breakdown.push('+20 status is interested');
  }

  if (lead.follow_up_date) {
    const today = new Date().toISOString().split('T')[0];
    if (lead.follow_up_date === today) {
      score += 10;
      breakdown.push('+10 follow-up due today');
    }
  }

  // Cap between 0 and 100
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    scoreBreakdown: breakdown.join('\n')
  };
}

module.exports = { scoreLead };
