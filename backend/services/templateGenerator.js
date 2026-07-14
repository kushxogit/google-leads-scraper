function generateTemplates(lead) {
  let observation = 'I found your business while checking local businesses in your area.';

  if (!lead.website || lead.website === 'N/A' || lead.website === '') {
    observation = 'I could not find a proper website for your business.';
  } else {
    observation = 'I found your business online and wanted to share a quick idea to improve inquiries.';
  }

  const businessName = lead.business_name || lead.businessName || 'there';
  const niche = lead.niche || 'local';
  const area = lead.area || 'your area';
  const recommendedOffer = lead.recommended_offer || lead.recommendedOffer || 'Website/app/business automation consultation';

  const whatsapp = `Hi ${businessName}, I found your business while checking ${niche} services in ${area}.

${observation}

I help local businesses build websites, apps, and automation systems to get more inquiries and reduce manual follow-ups.

I had an idea around: ${recommendedOffer}.

Can I send you a quick sample or improvement idea?`;

  const call = `Hey, is this the owner or manager of ${businessName}?
  
[Wait for yes]

Hi, my name is [Your Name]. I was looking for ${niche} services in ${area} and came across your profile.

${observation}

I help businesses like yours implement systems for ${recommendedOffer}. 
I know you're busy right now, but would you be open to me sending over a quick text with a sample or idea of how this looks?

[If yes] Great, I will WhatsApp it to this number. Thanks!`;

  return {
    whatsapp,
    call,
    observation
  };
}

module.exports = { generateTemplates };
