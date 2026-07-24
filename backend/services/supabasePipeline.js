function safeSupabaseUrl(value) {
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const hosted =
    url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  if (!local && !hosted) throw new Error("Invalid Supabase URL");
  return url.origin;
}

async function getUser(supabaseUrl, token, apiKey) {
  const url = safeSupabaseUrl(supabaseUrl);
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: apiKey, Authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  if (!response.ok || !body.id)
    throw new Error("Your session is invalid or expired. Sign in again.");
  return body;
}

async function verifyWorkspace(
  supabaseUrl,
  token,
  apiKey,
  workspaceId,
  userId,
) {
  const url = safeSupabaseUrl(supabaseUrl);
  const query = `${url}/rest/v1/workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=workspace_id`;
  const rows = await rest(query, token, apiKey);
  if (!rows.length)
    throw new Error("You do not have access to this workspace.");
}

async function loadLeadKeys(job, token) {
  const url = safeSupabaseUrl(job.supabase_url);
  const rows = await rest(
    `${url}/rest/v1/leads?workspace_id=eq.${encodeURIComponent(job.workspace_id)}&select=name,phone,metadata`,
    token,
    job.supabase_key,
  );
  const keys = new Set();
  rows.forEach((lead) =>
    addKeys(keys, {
      businessName: lead.name,
      phone: lead.phone,
      website: lead.metadata?.website,
      sourceUrl: lead.metadata?.source_url,
    }),
  );
  return keys;
}

function isKnownLead(keys, lead) {
  return leadKeys(lead).some((key) => keys.has(key));
}
function addKeys(keys, lead) {
  leadKeys(lead).forEach((key) => keys.add(key));
}
function leadKeys(lead) {
  return [
    lead.phone && `phone:${lead.phone.replace(/\D/g, "")}`,
    lead.website &&
      lead.website !== "N/A" &&
      `website:${lead.website.toLowerCase()}`,
    lead.sourceUrl && `source:${lead.sourceUrl}`,
    lead.businessName &&
      lead.area &&
      `name:${lead.businessName.toLowerCase()}|${lead.area.toLowerCase()}`,
  ].filter(Boolean);
}

async function insertLead(
  job,
  token,
  lead,
  score,
  scoreBreakdown,
  recommendedOffer,
) {
  const url = safeSupabaseUrl(job.supabase_url);
  const payload = {
    workspace_id: job.workspace_id,
    created_by: job.created_by,
    name: lead.businessName,
    phone: lead.phone || null,
    email: lead.email || null,
    source: lead.source || "Google Maps",
    status: "new",
    metadata: {
      niche: lead.niche || null,
      area: lead.area || null,
      website: lead.website || null,
      address: lead.address || null,
      rating: lead.rating,
      reviews: lead.reviews,
      source_url: lead.sourceUrl || null,
      score,
      score_breakdown: scoreBreakdown,
      recommended_offer: recommendedOffer,
      remarks: null,
      scrape_job_id: job.id,
    },
  };
  return rest(`${url}/rest/v1/leads`, token, job.supabase_key, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

async function rest(url, token, apiKey, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.message || body.hint || body.error || "Supabase request failed",
    );
  return body;
}

module.exports = {
  getUser,
  verifyWorkspace,
  loadLeadKeys,
  isKnownLead,
  addKeys,
  insertLead,
  safeSupabaseUrl,
};
