begin;

-- Additive client fields. Existing pipeline statuses remain the lifecycle source of truth.
alter table public.leads add column if not exists website text;
alter table public.leads add column if not exists required_service text;
alter table public.leads add column if not exists project_value numeric(12,2);
alter table public.leads add column if not exists last_conversation_at timestamptz;
alter table public.leads add column if not exists next_follow_up_at timestamptz;
alter table public.leads add column if not exists payment_status text not null default 'not_set';
alter table public.leads add column if not exists pending_feedback boolean not null default false;
alter table public.leads add column if not exists important_notes text;
alter table public.leads add column if not exists social_links jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leads_payment_status_check') then
    alter table public.leads add constraint leads_payment_status_check
      check (payment_status in ('not_set','pending','partial','paid','not_applicable'));
  end if;
end $$;

create index if not exists leads_workspace_follow_up_idx on public.leads (workspace_id, next_follow_up_at);
create index if not exists leads_workspace_payment_idx on public.leads (workspace_id, payment_status);
create index if not exists leads_workspace_feedback_idx on public.leads (workspace_id, pending_feedback);

create table public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  raw_note text not null check (char_length(trim(raw_note)) between 1 and 20000),
  channel text not null default 'other' check (channel in ('call','email','whatsapp','meeting','other')),
  summary text,
  outcome text,
  next_step text,
  follow_up_date date,
  feedback_status text not null default 'unchanged' check (feedback_status in ('unchanged','pending','received','not_required')),
  payment_status text not null default 'unchanged' check (payment_status in ('unchanged','not_set','pending','partial','paid','not_applicable')),
  service text,
  suggested_status text check (suggested_status is null or suggested_status in ('new','contacted','qualified','proposal','won','lost')),
  ai_payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'processing' check (processing_status in ('processing','needs_review','applied','failed')),
  processing_error text,
  manually_edited_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(manually_edited_fields) = 'array'),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lead_interactions_lead_created_idx on public.lead_interactions (lead_id, created_at desc);
create index lead_interactions_workspace_status_idx on public.lead_interactions (workspace_id, processing_status, created_at desc);
create trigger lead_interactions_updated_at before update on public.lead_interactions for each row execute function public.set_updated_at();

create table public.interaction_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null unique references public.lead_interactions(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','needs_review','applied','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  next_attempt_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interaction_processing_jobs_queue_idx on public.interaction_processing_jobs (workspace_id, status, next_attempt_at);
create trigger interaction_processing_jobs_updated_at before update on public.interaction_processing_jobs for each row execute function public.set_updated_at();

create table public.acquisition_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null check (platform in ('freelancer','linkedin','instagram')),
  positioning text not null default '',
  services text not null default '',
  proof text not null default '',
  trust_signals text not null default '',
  profile_url text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, platform)
);
create trigger acquisition_profiles_updated_at before update on public.acquisition_profiles for each row execute function public.set_updated_at();

create table public.proof_library (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  proof_type text not null default 'completed_work' check (proof_type in ('completed_work','audit','automation','development_lesson','growth_idea')),
  summary text not null default '',
  asset_url text,
  notes text,
  completed_at date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index proof_library_workspace_idx on public.proof_library (workspace_id, created_at desc);
create trigger proof_library_updated_at before update on public.proof_library for each row execute function public.set_updated_at();

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null check (platform in ('freelancer','linkedin','instagram','other')),
  title text not null check (char_length(trim(title)) between 1 and 180),
  draft text not null default '',
  proof_asset_id uuid references public.proof_library(id) on delete set null,
  cta text,
  status text not null default 'idea' check (status in ('idea','draft','ready','published','archived')),
  publish_at timestamptz,
  external_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_items_workspace_publish_idx on public.content_items (workspace_id, publish_at, status);
create trigger content_items_updated_at before update on public.content_items for each row execute function public.set_updated_at();

create table public.relationship_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_name text not null check (char_length(trim(contact_name)) between 1 and 160),
  company text,
  channel text,
  relationship_stage text not null default 'new' check (relationship_stage in ('new','warm','active','partner','paused')),
  last_touch_at timestamptz,
  next_touch_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index relationship_contacts_workspace_touch_idx on public.relationship_contacts (workspace_id, next_touch_at);
create trigger relationship_contacts_updated_at before update on public.relationship_contacts for each row execute function public.set_updated_at();

create table public.outreach_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  relationship_id uuid references public.relationship_contacts(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp','linkedin','instagram','freelancer','other')),
  message_draft text not null default '',
  status text not null default 'draft' check (status in ('draft','ready','sent','replied','skipped')),
  next_action_at timestamptz,
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lead_id is not null or relationship_id is not null)
);
create index outreach_queue_workspace_action_idx on public.outreach_queue (workspace_id, next_action_at, status);
create trigger outreach_queue_updated_at before update on public.outreach_queue for each row execute function public.set_updated_at();

alter table public.lead_interactions enable row level security;
alter table public.interaction_processing_jobs enable row level security;
alter table public.acquisition_profiles enable row level security;
alter table public.proof_library enable row level security;
alter table public.content_items enable row level security;
alter table public.relationship_contacts enable row level security;
alter table public.outreach_queue enable row level security;

create policy "Members manage interactions" on public.lead_interactions for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id) and author_id = auth.uid());
create policy "Members manage interaction jobs" on public.interaction_processing_jobs for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "Members manage acquisition profiles" on public.acquisition_profiles for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "Members manage proof library" on public.proof_library for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "Members manage content items" on public.content_items for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "Members manage relationship contacts" on public.relationship_contacts for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "Members manage outreach queue" on public.outreach_queue for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

alter table public.lead_interactions replica identity full;
alter table public.interaction_processing_jobs replica identity full;
alter table public.acquisition_profiles replica identity full;
alter table public.proof_library replica identity full;
alter table public.content_items replica identity full;
alter table public.relationship_contacts replica identity full;
alter table public.outreach_queue replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lead_interactions') then alter publication supabase_realtime add table public.lead_interactions; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'interaction_processing_jobs') then alter publication supabase_realtime add table public.interaction_processing_jobs; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'acquisition_profiles') then alter publication supabase_realtime add table public.acquisition_profiles; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'proof_library') then alter publication supabase_realtime add table public.proof_library; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'content_items') then alter publication supabase_realtime add table public.content_items; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'relationship_contacts') then alter publication supabase_realtime add table public.relationship_contacts; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'outreach_queue') then alter publication supabase_realtime add table public.outreach_queue; end if;
end $$;

notify pgrst, 'reload schema';
commit;
