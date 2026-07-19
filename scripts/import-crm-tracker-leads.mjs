#!/usr/bin/env node

/**
 * Imports CRM Tracker CSV rows into the current Supabase `leads` table.
 *
 * Required environment variables for a real import:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WORKSPACE_ID, CREATED_BY_USER_ID
 *
 * Usage:
 *   node scripts/import-crm-tracker-leads.mjs --dry-run
 *   node scripts/import-crm-tracker-leads.mjs
 *   node scripts/import-crm-tracker-leads.mjs path/to/leads.csv
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const defaultFile = new URL('../data/crm-tracker-leads.csv', import.meta.url);
const file = process.argv.find((arg) => !arg.startsWith('-') && arg !== process.argv[0] && arg !== process.argv[1]) ?? defaultFile;
const dryRun = process.argv.includes('--dry-run');
const stageMap = { CALLED: 'contacted', 'FOLLOW UP': 'contacted', 'TO CALL': 'new', 'PROPOSAL SENT': 'proposal', INTERESTED: 'qualified', NEW: 'new', LOST: 'lost' };

const csv = await readFile(file instanceof URL ? file : resolve(file), 'utf8');
const rows = parseCsv(csv);
const leads = rows.map((row, index) => toLead(row, index + 2));

if (dryRun) {
  console.table(leads.map(({ name, phone, status, metadata }) => ({ name, phone, status, niche: metadata.niche, source_status: metadata.source_status })));
  console.log(`Dry run complete: ${leads.length} leads would be imported.`);
  process.exit(0);
}

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WORKSPACE_ID', 'CREATED_BY_USER_ID'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);

const base = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
const headers = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
const existing = await request(`${base}/leads?workspace_id=eq.${encodeURIComponent(process.env.WORKSPACE_ID)}&select=name,phone`, { headers });
const keys = new Set(existing.map((lead) => identity(lead.name, lead.phone)));
const fresh = leads.filter((lead) => !keys.has(identity(lead.name, lead.phone)));

if (!fresh.length) {
  console.log('No rows imported: every CSV lead already exists in this workspace.');
  process.exit(0);
}
const imported = await request(`${base}/leads`, {
  method: 'POST', headers: { ...headers, Prefer: 'return=representation' },
  body: JSON.stringify(fresh.map((lead) => ({ ...lead, workspace_id: process.env.WORKSPACE_ID, created_by: process.env.CREATED_BY_USER_ID }))),
});
console.log(`Imported ${imported.length} leads; skipped ${leads.length - fresh.length} existing leads.`);

function toLead(row, line) {
  const originalStatus = String(row.status || '').trim().toUpperCase();
  if (!row.business_name?.trim()) throw new Error(`Line ${line}: business_name is required.`);
  if (!stageMap[originalStatus]) throw new Error(`Line ${line}: unsupported status "${row.status}".`);
  return {
    name: row.business_name.trim(), phone: row.phone?.trim() || null, email: null, company: null, source: row.source?.trim() || 'crm-tracker-import', status: stageMap[originalStatus],
    metadata: { niche: row.niche?.trim() || null, area: row.area?.trim() || null, remarks: row.remarks?.trim() || null, source_status: originalStatus, imported_from: 'CRM Tracker' },
  };
}

function identity(name, phone) { return `${String(name || '').trim().toLowerCase()}|${String(phone || '').replace(/\D/g, '')}`; }
async function request(url, options) { const response = await fetch(url, options); const body = await response.json(); if (!response.ok) throw new Error(body.message || body.hint || JSON.stringify(body)); return body; }

function parseCsv(text) {
  const records = []; let row = []; let value = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') index += 1; row.push(value); if (row.some((cell) => cell.length)) records.push(row); row = []; value = ''; }
    else value += char;
  }
  if (value.length || row.length) { row.push(value); records.push(row); }
  const [header, ...data] = records;
  return data.map((cells) => Object.fromEntries(header.map((key, index) => [key.trim(), (cells[index] ?? '').trim()])));
}
