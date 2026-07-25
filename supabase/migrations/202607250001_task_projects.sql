begin;

-- ─── Task Projects ───────────────────────────────────────────────────────────
-- Named groupings for tasks (like "Q3 Outreach", "Website Redesign")

create table public.task_projects (
  id         uuid      primary key default gen_random_uuid(),
  workspace_id uuid    not null references public.workspaces(id) on delete cascade,
  name       text      not null check (char_length(trim(name)) between 1 and 80),
  color      text      not null default 'violet'
               check (color in ('violet','sky','emerald','amber','rose','zinc','indigo','orange')),
  emoji      text      check (char_length(emoji) <= 4),
  position   smallint  not null default 0,
  created_by uuid      not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create index task_projects_workspace_idx
  on public.task_projects (workspace_id, position, created_at);

create trigger task_projects_updated_at
  before update on public.task_projects
  for each row execute function public.set_updated_at();

-- ─── Checklist / Sub-tasks ────────────────────────────────────────────────────
-- Ordered checklist items that live under a task

create table public.task_checklist_items (
  id           uuid      primary key default gen_random_uuid(),
  task_id      uuid      not null references public.tasks(id) on delete cascade,
  workspace_id uuid      not null references public.workspaces(id) on delete cascade,
  body         text      not null check (char_length(trim(body)) between 1 and 500),
  completed    boolean   not null default false,
  completed_at timestamptz,
  completed_by uuid      references auth.users(id) on delete set null,
  position     smallint  not null default 0,
  created_by   uuid      not null references auth.users(id) on delete restrict,
  created_at   timestamptz not null default now()
);

create index task_checklist_items_task_idx
  on public.task_checklist_items (task_id, position, created_at);

-- Validate that checklist items belong to the same workspace as their task
create or replace function public.validate_checklist_item_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.tasks
    where id = new.task_id and workspace_id = new.workspace_id
  ) then
    raise exception 'Checklist item workspace must match its task';
  end if;
  -- Auto-stamp completed_at when toggling
  if new.completed and not coalesce(old.completed, false) then
    new.completed_at := now();
    new.completed_by := auth.uid();
  elsif not new.completed then
    new.completed_at := null;
    new.completed_by := null;
  end if;
  return new;
end; $$;

create trigger task_checklist_items_validate
  before insert or update on public.task_checklist_items
  for each row execute function public.validate_checklist_item_workspace();

-- ─── Extend tasks with project_id ─────────────────────────────────────────────
-- Nullable: existing tasks are unaffected

alter table public.tasks
  add column if not exists project_id uuid
    references public.task_projects(id) on delete set null;

create index tasks_workspace_project_idx
  on public.tasks (workspace_id, project_id);

-- Validate that a task's project belongs to the same workspace
create or replace function public.validate_task_project_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.task_projects
    where id = new.project_id and workspace_id = new.workspace_id
  ) then
    raise exception 'Task project must belong to the same workspace';
  end if;
  return new;
end; $$;

create trigger tasks_validate_project
  before insert or update on public.tasks
  for each row execute function public.validate_task_project_workspace();

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.task_projects enable row level security;
create policy "Members manage task projects" on public.task_projects
  for all to authenticated
  using  (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

alter table public.task_checklist_items enable row level security;
create policy "Members manage checklist items" on public.task_checklist_items
  for all to authenticated
  using  (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ─── Realtime ─────────────────────────────────────────────────────────────────

alter table public.task_projects replica identity full;
alter table public.task_checklist_items replica identity full;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_projects'
  ) then
    alter publication supabase_realtime add table public.task_projects;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_checklist_items'
  ) then
    alter publication supabase_realtime add table public.task_checklist_items;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
