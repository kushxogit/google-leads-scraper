begin;

create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  type text not null check (type in ('personal', 'team')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index workspaces_one_personal_per_user on public.workspaces (created_by) where type = 'personal';

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  unique (workspace_id, email)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  phone text, email text, company text, source text,
  status text not null default 'new' check (status in ('new','contacted','qualified','proposal','won','lost')),
  assigned_to uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_workspace_id_idx on public.leads (workspace_id);
create index leads_workspace_status_idx on public.leads (workspace_id, status);
create index leads_workspace_assigned_to_idx on public.leads (workspace_id, assigned_to);

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  author_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lead_notes_lead_created_idx on public.lead_notes (lead_id, created_at);

create table public.lead_activity (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('lead_created','status_changed','whatsapp_clicked','note_added')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index lead_activity_lead_created_idx on public.lead_activity (lead_id, created_at desc);

create table public.lead_attachments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null, mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now()
);
create index lead_attachments_lead_idx on public.lead_attachments (lead_id);

create table public.integration_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type = 'lead.created'),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  attempts integer not null default 0
);
create index integration_events_pending_idx on public.integration_events (created_at) where delivered_at is null;

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger workspaces_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger leads_updated_at before update on public.leads for each row execute function public.set_updated_at();
create trigger lead_notes_updated_at before update on public.lead_notes for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = auth.uid());
$$;
grant execute on function public.is_workspace_member(uuid) to authenticated;

create or replace function public.add_workspace_creator_as_member() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.workspace_members (workspace_id, user_id) values (new.id, new.created_by) on conflict do nothing; return new; end; $$;
create trigger workspaces_add_creator after insert on public.workspaces for each row execute function public.add_workspace_creator_as_member();

create or replace function public.create_personal_workspace_for_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspaces (name, type, created_by)
  values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'My') || '''s Workspace', 'personal', new.id);
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_personal_workspace_for_new_user();

create or replace function public.validate_lead_assignee() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null and not exists (select 1 from public.workspace_members where workspace_id = new.workspace_id and user_id = new.assigned_to) then
    raise exception 'Lead assignee must belong to the lead workspace';
  end if;
  return new;
end; $$;
create trigger leads_validate_assignee before insert or update of workspace_id, assigned_to on public.leads for each row execute function public.validate_lead_assignee();

create or replace function public.validate_child_lead_workspace() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.leads where id = new.lead_id and workspace_id = new.workspace_id) then raise exception 'Lead and workspace must match'; end if;
  return new;
end; $$;
create trigger lead_notes_validate_workspace before insert or update of lead_id, workspace_id on public.lead_notes for each row execute function public.validate_child_lead_workspace();
create trigger lead_attachments_validate_workspace before insert or update of lead_id, workspace_id on public.lead_attachments for each row execute function public.validate_child_lead_workspace();

create or replace function public.validate_attachment_storage_path() returns trigger language plpgsql set search_path = public as $$
declare expected_prefix text;
begin
  expected_prefix := new.workspace_id::text || '/' || new.lead_id::text || '/';
  if left(new.storage_path, char_length(expected_prefix)) <> expected_prefix then raise exception 'Attachment path must begin with workspace_id/lead_id/'; end if;
  return new;
end; $$;
create trigger lead_attachments_validate_path before insert or update of storage_path, workspace_id, lead_id on public.lead_attachments for each row execute function public.validate_attachment_storage_path();

create or replace function public.record_lead_activity() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_activity (lead_id, workspace_id, actor_id, event_type, details) values (new.id, new.workspace_id, auth.uid(), 'lead_created', jsonb_build_object('status', new.status));
  elsif new.status is distinct from old.status then
    insert into public.lead_activity (lead_id, workspace_id, actor_id, event_type, details) values (new.id, new.workspace_id, auth.uid(), 'status_changed', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end; $$;
create trigger leads_record_activity after insert or update of status on public.leads for each row execute function public.record_lead_activity();

create or replace function public.record_note_activity() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.lead_activity (lead_id, workspace_id, actor_id, event_type, details) values (new.lead_id, new.workspace_id, new.author_id, 'note_added', jsonb_build_object('note_id', new.id));
  return new;
end; $$;
create trigger lead_notes_record_activity after insert on public.lead_notes for each row execute function public.record_note_activity();

create or replace function public.queue_new_lead_integration_event() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.integration_events (event_type, workspace_id, lead_id, payload) values ('lead.created', new.workspace_id, new.id, jsonb_build_object('lead_id',new.id,'workspace_id',new.workspace_id,'created_at',new.created_at));
  return new;
end; $$;
create trigger leads_queue_integration_event after insert on public.leads for each row execute function public.queue_new_lead_integration_event();

create or replace function public.record_whatsapp_click(p_lead_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare lead_workspace_id uuid;
begin
  select workspace_id into lead_workspace_id from public.leads where id = p_lead_id;
  if lead_workspace_id is null or not public.is_workspace_member(lead_workspace_id) then raise exception 'Lead not found or access denied'; end if;
  insert into public.lead_activity (lead_id,workspace_id,actor_id,event_type) values (p_lead_id,lead_workspace_id,auth.uid(),'whatsapp_clicked');
end; $$;
grant execute on function public.record_whatsapp_click(uuid) to authenticated;

create or replace function public.create_workspace_invite(p_workspace_id uuid, p_email text) returns uuid language plpgsql security definer set search_path = public as $$
declare invite_token uuid;
begin
  if not public.is_workspace_member(p_workspace_id) then raise exception 'Access denied'; end if;
  if not exists (select 1 from public.workspaces where id = p_workspace_id and type = 'team') then raise exception 'Invitations are only supported for team workspaces'; end if;
  insert into public.workspace_invites (workspace_id,email,invited_by,expires_at) values (p_workspace_id,lower(trim(p_email)),auth.uid(),now()+interval '7 days')
  on conflict (workspace_id,email) do update set token=gen_random_uuid(), invited_by=excluded.invited_by, created_at=now(), expires_at=excluded.expires_at returning token into invite_token;
  return invite_token;
end; $$;
grant execute on function public.create_workspace_invite(uuid, text) to authenticated;

create or replace function public.accept_workspace_invite(p_token uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare invite_record public.workspace_invites; current_email text;
begin
  current_email := lower(coalesce(auth.jwt() ->> 'email',''));
  select * into invite_record from public.workspace_invites where token=p_token and expires_at > now();
  if invite_record.id is null then raise exception 'Invitation is invalid or expired'; end if;
  if current_email <> invite_record.email then raise exception 'Sign in using the email address that received this invitation'; end if;
  insert into public.workspace_members (workspace_id,user_id) values (invite_record.workspace_id,auth.uid()) on conflict do nothing;
  delete from public.workspace_invites where id=invite_record.id;
  return invite_record.workspace_id;
end; $$;
grant execute on function public.accept_workspace_invite(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_activity enable row level security;
alter table public.lead_attachments enable row level security;
alter table public.integration_events enable row level security;

create policy "Members view workspaces" on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy "Users create workspaces" on public.workspaces for insert to authenticated with check (created_by = auth.uid());
create policy "Members update workspaces" on public.workspaces for update to authenticated using (public.is_workspace_member(id)) with check (public.is_workspace_member(id));
create policy "Members delete workspaces" on public.workspaces for delete to authenticated using (public.is_workspace_member(id));
create policy "Members view memberships" on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Members view invites" on public.workspace_invites for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Members delete invites" on public.workspace_invites for delete to authenticated using (public.is_workspace_member(workspace_id));

create policy "Members view leads" on public.leads for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Members create leads" on public.leads for insert to authenticated with check (public.is_workspace_member(workspace_id) and created_by=auth.uid());
create policy "Members update leads" on public.leads for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "Members delete leads" on public.leads for delete to authenticated using (public.is_workspace_member(workspace_id));

create policy "Members view notes" on public.lead_notes for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Members create notes" on public.lead_notes for insert to authenticated with check (public.is_workspace_member(workspace_id) and author_id=auth.uid());
create policy "Members update notes" on public.lead_notes for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "Members delete notes" on public.lead_notes for delete to authenticated using (public.is_workspace_member(workspace_id));
create policy "Members view activity" on public.lead_activity for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Members view attachment metadata" on public.lead_attachments for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Members create attachment metadata" on public.lead_attachments for insert to authenticated with check (public.is_workspace_member(workspace_id) and uploaded_by=auth.uid());
create policy "Members update attachment metadata" on public.lead_attachments for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "Members delete attachment metadata" on public.lead_attachments for delete to authenticated using (public.is_workspace_member(workspace_id));

insert into storage.buckets (id,name,public) values ('lead-attachments','lead-attachments',false) on conflict (id) do update set public=false;
create or replace function public.can_access_workspace_storage_path(p_path text) returns boolean language plpgsql stable security definer set search_path = public as $$
declare workspace_id_from_path uuid;
begin
  if p_path !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then return false; end if;
  workspace_id_from_path := split_part(p_path,'/',1)::uuid;
  return public.is_workspace_member(workspace_id_from_path);
end; $$;
grant execute on function public.can_access_workspace_storage_path(text) to authenticated;
create policy "Members read attachment files" on storage.objects for select to authenticated using (bucket_id='lead-attachments' and public.can_access_workspace_storage_path(name));
create policy "Members upload attachment files" on storage.objects for insert to authenticated with check (bucket_id='lead-attachments' and public.can_access_workspace_storage_path(name));
create policy "Members update attachment files" on storage.objects for update to authenticated using (bucket_id='lead-attachments' and public.can_access_workspace_storage_path(name)) with check (bucket_id='lead-attachments' and public.can_access_workspace_storage_path(name));
create policy "Members delete attachment files" on storage.objects for delete to authenticated using (bucket_id='lead-attachments' and public.can_access_workspace_storage_path(name));

alter table public.leads replica identity full;
alter table public.lead_notes replica identity full;
alter table public.lead_activity replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='leads') then alter publication supabase_realtime add table public.leads; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='lead_notes') then alter publication supabase_realtime add table public.lead_notes; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='lead_activity') then alter publication supabase_realtime add table public.lead_activity; end if;
end $$;

notify pgrst, 'reload schema';

commit;
