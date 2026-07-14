function generateRecommendedOffer(lead) {
  if (!lead.website || lead.website === 'N/A' || lead.website === '') {
    return 'Starter website + WhatsApp inquiry setup';
  }

  const niche = (lead.niche || '').toLowerCase();

  if (niche.includes('dentist') || niche.includes('clinic') || niche.includes('doctor')) {
    return 'Appointment booking website + reminder automation';
  }

  if (niche.includes('salon') || niche.includes('spa')) {
    return 'Booking website + WhatsApp follow-up automation';
  }

  if (niche.includes('gym')) {
    return 'Trial booking landing page + membership follow-up system';
  }

  if (niche.includes('real estate')) {
    return 'Lead capture landing page + simple CRM';
  }

  if (niche.includes('coaching') || niche.includes('institute') || niche.includes('school')) {
    return 'Admission inquiry form + follow-up automation';
  }

  if (niche.includes('restaurant') || niche.includes('cafe')) {
    return 'Menu website + order inquiry flow';
  }

  if (niche.includes('lawyer')) {
    return 'Professional website + consultation inquiry form';
  }

  if (
    niche.includes('architect') ||
    niche.includes('interior designer') ||
    niche.includes('photographer') ||
    niche.includes('event planner')
  ) {
    return 'Portfolio website + lead inquiry form';
  }

  return 'Website/app/business automation consultation';
}

module.exports = { generateRecommendedOffer };
