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

  const emailSubject = `Quick idea for ${businessName}`;
  const emailBody = `Hi ${businessName},

We are a team of freelancers from Gurgaon and we noticed your business while checking local services in ${area}.

Since your business is not fully optimized in the online space, as a business like yours, it's highly beneficial to have a strong website to increase reach and visibility in your area.

We will make one for you at a very minimal, affordable charge.

We can also build AI automations for you, like AI Appointment Schedulers, Lead Managers, etc.
Also, if you are interested in Meta Ads, we can do that too!

Let me know if you are open to seeing some samples.

Best regards,
[Your Name]`;

  return {
    whatsapp,
    call,
    emailSubject,
    emailBody,
    observation
  };
}

module.exports = { generateTemplates };
