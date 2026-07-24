# Lead workflow foundations — backend handoff

Status: Backend and frontend foundation integrated; database migration pending deployment

## Delivered by Codex

- `supabase/migrations/202607240001_lead_workflow_foundations.sql`
  - Workspace-configurable lead fields, tags, tag-to-lead links, and saved Pipeline views.
  - `get_lead_timeline(p_lead_id)` merges native lead events with activity from linked tasks.
  - `record_lead_outreach_action(p_lead_id, p_channel)` records **draft opened**, not a false “sent” claim.
  - Attachment uploads are recorded in `lead_activity`.
- The scraper now writes `metadata.scrape_job_id`; review acknowledgement persists as `scrape_jobs.reviewed_at`.
- `PATCH /api/scrape-jobs/:id/review` accepts `{ "reviewed": true | false }` and uses the existing workspace authentication headers.
- Shared frontend contract expanded in `specs/types.ts`.

## Frontend integration completed

1. Home now has a compact action queue for overdue and today’s work, with a direct path to opportunities lacking a next action.
2. Navigation now uses `Today` and `Find leads`; icon-only menu and notification controls have accessible labels.
3. Pipeline supports saved views, tag filtering, and `scrape_job`-scoped links from scanner results.
4. Lead detail uses `get_lead_timeline` and records email/WhatsApp draft openings before handing off to the external client.
5. Lead detail lets workspace members create and apply tags without leaving the opportunity.
6. Completed scraper jobs can be marked reviewed and send users directly to the imported lead batch.

## Guardrails

- Do not add sprints, story points, epics, backlogs, or custom Jira-style workflow engines.
- “Sent” must never be shown unless the app later owns actual provider delivery confirmation.
- `workspace_lead_fields`, tags, and views are realtime-enabled; filter UI can use direct Supabase access following existing hooks.
