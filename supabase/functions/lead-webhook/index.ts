import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const webhookUrl = Deno.env.get('INTEGRATION_WEBHOOK_URL');
  if (!webhookUrl) return Response.json({ delivered: 0, enabled: false }, { headers: cors });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: events, error } = await supabase.from('integration_events').select('*').is('delivered_at', null).order('created_at').limit(20);
  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
  let delivered = 0;
  for (const event of events ?? []) {
    const response = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(Deno.env.get('INTEGRATION_WEBHOOK_SECRET') ? { 'X-LeadPilot-Signature': Deno.env.get('INTEGRATION_WEBHOOK_SECRET')! } : {}) }, body: JSON.stringify({ type: event.event_type, workspace_id: event.workspace_id, lead_id: event.lead_id, payload: event.payload }) });
    if (response.ok) { await supabase.from('integration_events').update({ delivered_at: new Date().toISOString(), attempts: event.attempts + 1 }).eq('id', event.id); delivered++; }
    else await supabase.from('integration_events').update({ attempts: event.attempts + 1 }).eq('id', event.id);
  }
  return Response.json({ delivered, enabled: true }, { headers: cors });
});
