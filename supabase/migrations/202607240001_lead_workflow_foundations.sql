begin;

-- Keep the CRM flexible without adopting a full issue-tracker configuration model.
create table public.workspace_lead_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,48}$'),
  label text not null check (char_length(trim(label)) between 1 and 80),
  field_type text not null check (field_type in ('text', 'number', 'date', 'select', 'url')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key)
);
create index workspace_lead_fields_order_idx on public.workspace_lead_fields (workspace_id, position, created_at);
create trigger workspace_lead_fields_updated_at before update on public.workspace_lead_fields for each row execute function public.set_updated_at();

create table public.workspace_lead_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  color text not null default 'violet' check (color in ('zinc', 'violet', 'sky', 'emerald', 'amber', 'rose')),
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.lead_tag_links (
  lead_id uuid not null references public.leads(id) on delete cascade,
  tag_id uuid not null references public.workspace_lead_tags(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id, tag_id)
);
create index lead_tag_links_workspace_tag_idx on public.lead_tag_links (workspace_id, tag_id, lead_id);

create or replace function public.validate_lead_tag_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.leads where id = new.lead_id and workspace_id = new.workspace_id) then
    raise exception 'Lead and workspace must match';
  end if;
  if not exists (select 1 from public.workspace_lead_tags where id = new.tag_id and workspace_id = new.workspace_id) then
    raise exception 'Tag and workspace must match';
  end if;
  return new;
end; $$;
create trigger lead_tag_links_validate_workspace before insert or update on public.lead_tag_links for each row execute function public.validate_lead_tag_workspace();

create table public.saved_pipeline_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  visibility text not null default 'personal' check (visibility in ('personal', 'workspace')),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_pipeline_views_access_idx on public.saved_pipeline_views (workspace_id, visibility, created_by, updated_at desc);
create unique index saved_pipeline_views_one_default_per_user on public.saved_pipeline_views (workspace_id, created_by) where is_default;
create trigger saved_pipeline_views_updated_at before update on public.saved_pipeline_views for each row execute function public.set_updated_at();

-- A single feed for a lead combines its lifecycle with any task that is linked to it.
create or replace function public.get_lead_timeline(p_lead_id uuid)
returns table (
  id text,
  lead_id uuid,
  task_id uuid,
  actor_id uuid,
  source text,
  event_type text,
  details jsonb,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare target_workspace_id uuid;
begin
  select workspace_id into target_workspace_id from public.leads where id = p_lead_id;
  if target_workspace_id is null or not public.is_workspace_member(target_workspace_id) then
    raise exception 'Lead not found or access denied';
  end if;

  return query
  select * from (
    select 'lead:' || activity.id::text, activity.lead_id, null::uuid, activity.actor_id,
      'lead'::text, activity.event_type, activity.details, activity.created_at
    from public.lead_activity activity
    where activity.lead_id = p_lead_id
    union all
    select 'task:' || activity.id::text, task.lead_id, activity.task_id, activity.actor_id,
      'task'::text, activity.event_type, activity.details || jsonb_build_object('task_title', task.title), activity.created_at
    from public.task_activity activity
    join public.tasks task on task.id = activity.task_id
    where task.lead_id = p_lead_id
  ) as timeline
  order by timeline.created_at desc;
end; $$;
grant execute on function public.get_lead_timeline(uuid) to authenticated;

alter table public.lead_activity drop constraint if exists lead_activity_event_type_check;
alter table public.lead_activity add constraint lead_activity_event_type_check
  check (event_type in ('lead_created', 'status_changed', 'whatsapp_clicked', 'note_added', 'attachment_added', 'email_opened', 'whatsapp_opened'));

create or replace function public.record_lead_outreach_action(p_lead_id uuid, p_channel text)
returns void language plpgsql security definer set search_path = public as $$
declare target_workspace_id uuid;
begin
  if p_channel not in ('email', 'whatsapp') then raise exception 'Unsupported outreach channel'; end if;
  select workspace_id into target_workspace_id from public.leads where id = p_lead_id;
  if target_workspace_id is null or not public.is_workspace_member(target_workspace_id) then
    raise exception 'Lead not found or access denied';
  end if;
  insert into public.lead_activity (lead_id, workspace_id, actor_id, event_type, details)
  values (p_lead_id, target_workspace_id, auth.uid(), p_channel || '_opened', jsonb_build_object('channel', p_channel));
end; $$;
grant execute on function public.record_lead_outreach_action(uuid, text) to authenticated;

create or replace function public.record_attachment_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.lead_activity (lead_id, workspace_id, actor_id, event_type, details)
  values (new.lead_id, new.workspace_id, new.uploaded_by, 'attachment_added', jsonb_build_object('attachment_id', new.id, 'file_name', new.file_name));
  return new;
end; $$;
create trigger lead_attachments_record_activity after insert on public.lead_attachments for each row execute function public.record_attachment_activity();

alter table public.workspace_lead_fields enable row level security;
alter table public.workspace_lead_tags enable row level security;
alter table public.lead_tag_links enable row level security;
alter table public.saved_pipeline_views enable row level security;

create policy "Members manage lead fields" on public.workspace_lead_fields for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "Members manage lead tags" on public.workspace_lead_tags for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "Members manage lead tags links" on public.lead_tag_links for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "Members view permitted saved pipeline views" on public.saved_pipeline_views for select to authenticated
  using (public.is_workspace_member(workspace_id) and (visibility = 'workspace' or created_by = auth.uid()));
create policy "Members create their saved pipeline views" on public.saved_pipeline_views for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy "Creators update their saved pipeline views" on public.saved_pipeline_views for update to authenticated
  using (created_by = auth.uid() and public.is_workspace_member(workspace_id)) with check (created_by = auth.uid() and public.is_workspace_member(workspace_id));
create policy "Creators delete their saved pipeline views" on public.saved_pipeline_views for delete to authenticated
  using (created_by = auth.uid() and public.is_workspace_member(workspace_id));

alter table public.workspace_lead_fields replica identity full;
alter table public.workspace_lead_tags replica identity full;
alter table public.lead_tag_links replica identity full;
alter table public.saved_pipeline_views replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workspace_lead_fields') then alter publication supabase_realtime add table public.workspace_lead_fields; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workspace_lead_tags') then alter publication supabase_realtime add table public.workspace_lead_tags; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lead_tag_links') then alter publication supabase_realtime add table public.lead_tag_links; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'saved_pipeline_views') then alter publication supabase_realtime add table public.saved_pipeline_views; end if;
end $$;

notify pgrst, 'reload schema';

commit;
