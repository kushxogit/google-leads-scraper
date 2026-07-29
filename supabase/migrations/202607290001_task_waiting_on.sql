begin;

-- Keep the workflow state separate from the person or thing that needs to respond.
alter table public.tasks
  add column if not exists waiting_on text;

alter table public.tasks
  add constraint tasks_waiting_on_length
  check (waiting_on is null or char_length(trim(waiting_on)) <= 240);

create index if not exists tasks_workspace_waiting_idx
  on public.tasks (workspace_id)
  where status = 'waiting';

notify pgrst, 'reload schema';

commit;
