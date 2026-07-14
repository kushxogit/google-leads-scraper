function normalizeLead(rawLead) {
  return {
    businessName: rawLead.businessName || '',
    niche: rawLead.niche || '',
    area: rawLead.area || '',
    phone: rawLead.phone || '',
    email: rawLead.email || '',
    website: rawLead.website || '',
    address: rawLead.address || '',
    rating: rawLead.rating && !isNaN(parseFloat(rawLead.rating)) ? parseFloat(rawLead.rating) : null,
    reviews: rawLead.reviews && !isNaN(parseInt(rawLead.reviews, 10)) ? parseInt(rawLead.reviews, 10) : null,
    source: rawLead.source || '',
    sourceUrl: rawLead.sourceUrl || ''
  };
}

module.exports = { normalizeLead };
