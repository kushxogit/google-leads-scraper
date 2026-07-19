begin;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  description text not null default '' check (char_length(description) <= 20000),
  category text not null default 'development' check (category in ('meeting','document','proposal','follow_up','development','admin')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'unplanned' check (status in ('unplanned','planned','in_progress','waiting','done','cancelled')),
  due_at timestamptz,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  calendar_sync_enabled boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end is null or scheduled_start is not null),
  check (scheduled_end is null or scheduled_end > scheduled_start)
);
create index tasks_workspace_schedule_idx on public.tasks (workspace_id, scheduled_start);
create index tasks_workspace_status_idx on public.tasks (workspace_id, status);
create index tasks_workspace_lead_idx on public.tasks (workspace_id, lead_id);

create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index task_assignees_user_idx on public.task_assignees (workspace_id, user_id);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index task_comments_task_created_idx on public.task_comments (task_id, created_at);

create table public.task_activity (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created','updated','scheduled','completed','commented','assignees_changed')),
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index task_activity_task_created_idx on public.task_activity (task_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  task_id uuid references public.tasks(id) on delete cascade,
  type text not null check (type in ('assigned','mentioned','task_updated','due_soon')),
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, read_at, created_at desc);

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  provider_account_email text,
  calendar_id text not null default 'primary',
  encrypted_refresh_token text,
  sync_token text,
  status text not null default 'pending' check (status in ('pending','connected','error','disconnected')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, provider)
);

create table public.calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  provider_event_id text not null,
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_private boolean not null default true,
  source text not null default 'google' check (source in ('google','leadpilot')),
  provider_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  unique (workspace_id, user_id, provider, provider_event_id)
);
create index calendar_events_window_idx on public.calendar_event_links (workspace_id, starts_at, ends_at);

create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger task_comments_updated_at before update on public.task_comments for each row execute function public.set_updated_at();
create trigger calendar_connections_updated_at before update on public.calendar_connections for each row execute function public.set_updated_at();

create or replace function public.validate_task_relations() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null and not exists (select 1 from public.leads where id = new.lead_id and workspace_id = new.workspace_id) then raise exception 'Task and lead workspace must match'; end if;
  if new.status = 'done' and new.completed_at is null then new.completed_at = now(); end if;
  if new.status <> 'done' then new.completed_at = null; end if;
  if new.scheduled_start is not null and new.status = 'unplanned' then new.status = 'planned'; end if;
  return new;
end; $$;
create trigger tasks_validate before insert or update on public.tasks for each row execute function public.validate_task_relations();

create or replace function public.validate_task_assignee() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.tasks where id = new.task_id and workspace_id = new.workspace_id) then raise exception 'Task and workspace must match'; end if;
  if not exists (select 1 from public.workspace_members where workspace_id = new.workspace_id and user_id = new.user_id) then raise exception 'Assignee must belong to the workspace'; end if;
  if (select count(*) from public.task_assignees where task_id = new.task_id and user_id <> new.user_id) >= 2 then raise exception 'A task can have at most two owners'; end if;
  return new;
end; $$;
create trigger task_assignees_validate before insert or update on public.task_assignees for each row execute function public.validate_task_assignee();

create or replace function public.record_task_assignment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.task_activity (task_id,workspace_id,actor_id,event_type,details) values (new.task_id,new.workspace_id,auth.uid(),'assignees_changed',jsonb_build_object('assigned_user_id',new.user_id));
  if new.user_id <> auth.uid() then
    insert into public.notifications (workspace_id,recipient_id,actor_id,task_id,type,title,body)
    select new.workspace_id,new.user_id,auth.uid(),new.task_id,'assigned','A task was assigned to you',title from public.tasks where id=new.task_id;
  end if;
  return new;
end; $$;
create trigger task_assignees_record after insert on public.task_assignees for each row execute function public.record_task_assignment();

create or replace function public.validate_task_child() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.tasks where id = new.task_id and workspace_id = new.workspace_id) then raise exception 'Task and workspace must match'; end if;
  return new;
end; $$;
create trigger task_comments_validate before insert or update on public.task_comments for each row execute function public.validate_task_child();

create or replace function public.record_task_activity() returns trigger language plpgsql security definer set search_path = public as $$
declare kind text;
begin
  if tg_op = 'INSERT' then kind := 'created';
  elsif new.status = 'done' and old.status <> 'done' then kind := 'completed';
  elsif new.scheduled_start is distinct from old.scheduled_start then kind := 'scheduled';
  else kind := 'updated'; end if;
  insert into public.task_activity (task_id, workspace_id, actor_id, event_type, details)
  values (new.id, new.workspace_id, auth.uid(), kind, jsonb_build_object('status',new.status,'category',new.category));
  return new;
end; $$;
create trigger tasks_record_activity after insert or update on public.tasks for each row execute function public.record_task_activity();

create or replace function public.record_task_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare mentioned uuid;
begin
  insert into public.task_activity (task_id,workspace_id,actor_id,event_type,details) values (new.task_id,new.workspace_id,new.author_id,'commented',jsonb_build_object('comment_id',new.id));
  foreach mentioned in array new.mentioned_user_ids loop
    if mentioned <> new.author_id and exists (select 1 from public.workspace_members where workspace_id=new.workspace_id and user_id=mentioned) then
      insert into public.notifications (workspace_id,recipient_id,actor_id,task_id,type,title,body)
      select new.workspace_id,mentioned,new.author_id,new.task_id,'mentioned','You were mentioned',left(new.body,240)
      where not exists (select 1 from public.notifications where recipient_id=mentioned and task_id=new.task_id and type='mentioned' and created_at > now()-interval '5 seconds');
    end if;
  end loop;
  return new;
end; $$;
create trigger task_comments_record after insert on public.task_comments for each row execute function public.record_task_comment();

create or replace function public.refresh_due_task_notifications(p_workspace_id uuid) returns integer language plpgsql security definer set search_path = public as $$
declare inserted_count integer;
begin
  if not public.is_workspace_member(p_workspace_id) then raise exception 'Access denied'; end if;
  insert into public.notifications (workspace_id,recipient_id,actor_id,task_id,type,title,body)
  select task.workspace_id,auth.uid(),task.created_by,task.id,'due_soon','Task due soon',task.title
  from public.tasks task join public.task_assignees assignee on assignee.task_id=task.id and assignee.user_id=auth.uid()
  where task.workspace_id=p_workspace_id and task.status not in ('done','cancelled') and task.due_at between now() and now()+interval '24 hours'
    and not exists (select 1 from public.notifications notice where notice.recipient_id=auth.uid() and notice.task_id=task.id and notice.type='due_soon' and notice.created_at > now()-interval '20 hours');
  get diagnostics inserted_count = row_count;
  return inserted_count;
end; $$;
grant execute on function public.refresh_due_task_notifications(uuid) to authenticated;

alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_activity enable row level security;
alter table public.notifications enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendar_event_links enable row level security;

create policy "Members manage tasks" on public.tasks for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id) and created_by is not null);
create policy "Members manage task assignees" on public.task_assignees for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "Members manage task comments" on public.task_comments for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id) and author_id=auth.uid());
create policy "Members view task activity" on public.task_activity for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Users view own notifications" on public.notifications for select to authenticated using (recipient_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy "Users update own notifications" on public.notifications for update to authenticated using (recipient_id=auth.uid()) with check (recipient_id=auth.uid());
create policy "Users view own calendar connection" on public.calendar_connections for select to authenticated using (user_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy "Users manage own calendar connection" on public.calendar_connections for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy "Users view own calendar events" on public.calendar_event_links for select to authenticated using (user_id=auth.uid() and public.is_workspace_member(workspace_id));
create policy "Users manage own calendar events" on public.calendar_event_links for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and public.is_workspace_member(workspace_id));

create or replace function public.get_calendar_availability(p_workspace_id uuid, p_from timestamptz, p_to timestamptz)
returns table (id uuid, user_id uuid, task_id uuid, starts_at timestamptz, ends_at timestamptz, source text, display_title text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_workspace_member(p_workspace_id) then raise exception 'Access denied'; end if;
  return query select event.id,event.user_id,event.task_id,event.starts_at,event.ends_at,event.source,
    case when event.user_id=auth.uid() or event.source='leadpilot' or not event.is_private then coalesce(event.title,'Calendar event') else 'Busy' end
  from public.calendar_event_links event
  where event.workspace_id=p_workspace_id and event.starts_at < p_to and event.ends_at > p_from
  order by event.starts_at;
end; $$;
grant execute on function public.get_calendar_availability(uuid,timestamptz,timestamptz) to authenticated;

alter table public.tasks replica identity full;
alter table public.task_comments replica identity full;
alter table public.notifications replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tasks') then alter publication supabase_realtime add table public.tasks; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='task_comments') then alter publication supabase_realtime add table public.task_comments; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then alter publication supabase_realtime add table public.notifications; end if;
end $$;

commit;
