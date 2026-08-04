begin;

-- Interaction processing needs an explicit confidence/review lifecycle.
alter table public.lead_interactions
  add column if not exists ai_confidence numeric(4,3),
  add column if not exists reviewed_at timestamptz,
  add column if not exists dismissed_at timestamptz,
  add column if not exists automation_error text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lead_interactions_ai_confidence_check') then
    alter table public.lead_interactions add constraint lead_interactions_ai_confidence_check
      check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1));
  end if;
end $$;

create index if not exists lead_interactions_workspace_activity_idx
  on public.lead_interactions (workspace_id, dismissed_at, reviewed_at, created_at desc);

-- Every AI next step points to one durable task. The unique key makes retries idempotent.
alter table public.tasks
  add column if not exists source_interaction_id uuid
    references public.lead_interactions(id) on delete set null;

create unique index if not exists tasks_source_interaction_unique
  on public.tasks (source_interaction_id)
  where source_interaction_id is not null;
create index if not exists tasks_workspace_source_interaction_idx
  on public.tasks (workspace_id, source_interaction_id);

create or replace function public.validate_task_interaction_source()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.source_interaction_id is not null and not exists (
    select 1 from public.lead_interactions interaction
    where interaction.id = new.source_interaction_id
      and interaction.workspace_id = new.workspace_id
      and interaction.lead_id is not distinct from new.lead_id
  ) then
    raise exception 'Task and source interaction must share a workspace and lead';
  end if;
  return new;
end; $$;

drop trigger if exists tasks_validate_interaction_source on public.tasks;
create trigger tasks_validate_interaction_source
  before insert or update of source_interaction_id, workspace_id, lead_id on public.tasks
  for each row execute function public.validate_task_interaction_source();

alter table public.lead_interactions replica identity full;
alter table public.tasks replica identity full;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks') then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
