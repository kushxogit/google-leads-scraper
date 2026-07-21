begin;

create table public.workspace_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  title text not null default 'Untitled note' check (char_length(trim(title)) between 1 and 240),
  body text not null default '' check (char_length(body) <= 30000),
  color text not null default 'violet' check (color in ('violet', 'mint', 'amber', 'blue', 'rose')),
  is_pinned boolean not null default false,
  archived_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspace_notes_access_idx on public.workspace_notes (workspace_id, visibility, updated_at desc);
create index workspace_notes_owner_idx on public.workspace_notes (workspace_id, owner_id, updated_at desc);

create table public.workspace_note_lines (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.workspace_notes(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  line_order integer not null default 0,
  is_done boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspace_note_lines_note_order_idx on public.workspace_note_lines (note_id, line_order, created_at);

create table public.workspace_note_comments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.workspace_notes(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspace_note_comments_note_created_idx on public.workspace_note_comments (note_id, created_at);

alter table public.notifications
  add column if not exists note_id uuid references public.workspace_notes(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('assigned', 'mentioned', 'task_updated', 'due_soon', 'note_mentioned'));
create index if not exists notifications_note_idx on public.notifications (recipient_id, note_id, created_at desc);

alter table public.tasks
  add column if not exists source_note_id uuid references public.workspace_notes(id) on delete set null,
  add column if not exists source_note_line_id uuid references public.workspace_note_lines(id) on delete set null;
create index if not exists tasks_source_note_idx on public.tasks (workspace_id, source_note_id);
create index if not exists tasks_source_note_line_idx on public.tasks (workspace_id, source_note_line_id);

create or replace function public.can_access_workspace_note(p_note_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_notes note
    where note.id = p_note_id
      and public.is_workspace_member(note.workspace_id)
      and (note.visibility = 'shared' or note.owner_id = auth.uid())
  );
$$;
grant execute on function public.can_access_workspace_note(uuid) to authenticated;

create or replace function public.validate_workspace_note_child()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.workspace_notes
    where id = new.note_id and workspace_id = new.workspace_id
  ) then
    raise exception 'Note and workspace must match';
  end if;
  return new;
end; $$;
create trigger workspace_note_lines_validate
before insert or update of note_id, workspace_id on public.workspace_note_lines
for each row execute function public.validate_workspace_note_child();
create trigger workspace_note_comments_validate
before insert or update of note_id, workspace_id on public.workspace_note_comments
for each row execute function public.validate_workspace_note_child();

create or replace function public.validate_task_note_source()
returns trigger language plpgsql security definer set search_path = public as $$
declare source_note_workspace uuid;
declare source_line_note uuid;
begin
  if new.source_note_id is not null then
    select workspace_id into source_note_workspace from public.workspace_notes where id = new.source_note_id;
    if source_note_workspace is null or source_note_workspace <> new.workspace_id then
      raise exception 'Task and source note workspace must match';
    end if;
  end if;
  if new.source_note_line_id is not null then
    select note_id into source_line_note from public.workspace_note_lines where id = new.source_note_line_id and workspace_id = new.workspace_id;
    if source_line_note is null or new.source_note_id is distinct from source_line_note then
      raise exception 'Task and source note line must match';
    end if;
  end if;
  return new;
end; $$;
create trigger tasks_validate_note_source
before insert or update of source_note_id, source_note_line_id, workspace_id on public.tasks
for each row execute function public.validate_task_note_source();

create or replace function public.set_workspace_note_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  return new;
end; $$;
create trigger workspace_notes_updated_at before update on public.workspace_notes
for each row execute function public.set_workspace_note_updated_at();
create trigger workspace_note_lines_updated_at before update on public.workspace_note_lines
for each row execute function public.set_updated_at();
create trigger workspace_note_comments_updated_at before update on public.workspace_note_comments
for each row execute function public.set_updated_at();

create or replace function public.record_workspace_note_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare mentioned uuid;
begin
  foreach mentioned in array new.mentioned_user_ids loop
    if mentioned <> new.author_id
      and exists (select 1 from public.workspace_members where workspace_id = new.workspace_id and user_id = mentioned)
    then
      insert into public.notifications (workspace_id, recipient_id, actor_id, note_id, type, title, body)
      values (new.workspace_id, mentioned, new.author_id, new.note_id, 'note_mentioned', 'You were mentioned in a note', left(new.body, 240));
    end if;
  end loop;
  return new;
end; $$;
create trigger workspace_note_comments_record after insert on public.workspace_note_comments
for each row execute function public.record_workspace_note_comment();

alter table public.workspace_notes enable row level security;
alter table public.workspace_note_lines enable row level security;
alter table public.workspace_note_comments enable row level security;

create policy "Members view shared or own notes" on public.workspace_notes
for select to authenticated
using (public.is_workspace_member(workspace_id) and (visibility = 'shared' or owner_id = auth.uid()));
create policy "Users create their own notes" on public.workspace_notes
for insert to authenticated
with check (public.is_workspace_member(workspace_id) and owner_id = auth.uid());
create policy "Members edit accessible notes" on public.workspace_notes
for update to authenticated
using (public.is_workspace_member(workspace_id) and (visibility = 'shared' or owner_id = auth.uid()))
with check (public.is_workspace_member(workspace_id) and (visibility = 'shared' or owner_id = auth.uid()));
create policy "Owners delete notes" on public.workspace_notes
for delete to authenticated
using (public.is_workspace_member(workspace_id) and owner_id = auth.uid());

create policy "Members view accessible note lines" on public.workspace_note_lines
for select to authenticated using (public.can_access_workspace_note(note_id));
create policy "Members create accessible note lines" on public.workspace_note_lines
for insert to authenticated with check (public.can_access_workspace_note(note_id) and created_by = auth.uid());
create policy "Members edit accessible note lines" on public.workspace_note_lines
for update to authenticated using (public.can_access_workspace_note(note_id)) with check (public.can_access_workspace_note(note_id));
create policy "Members delete accessible note lines" on public.workspace_note_lines
for delete to authenticated using (public.can_access_workspace_note(note_id));

create policy "Members view accessible note comments" on public.workspace_note_comments
for select to authenticated using (public.can_access_workspace_note(note_id));
create policy "Members create accessible note comments" on public.workspace_note_comments
for insert to authenticated with check (public.can_access_workspace_note(note_id) and author_id = auth.uid());
create policy "Authors update note comments" on public.workspace_note_comments
for update to authenticated using (author_id = auth.uid() and public.can_access_workspace_note(note_id))
with check (author_id = auth.uid() and public.can_access_workspace_note(note_id));
create policy "Authors delete note comments" on public.workspace_note_comments
for delete to authenticated using (author_id = auth.uid() and public.can_access_workspace_note(note_id));

alter table public.workspace_notes replica identity full;
alter table public.workspace_note_lines replica identity full;
alter table public.workspace_note_comments replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='workspace_notes') then alter publication supabase_realtime add table public.workspace_notes; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='workspace_note_lines') then alter publication supabase_realtime add table public.workspace_note_lines; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='workspace_note_comments') then alter publication supabase_realtime add table public.workspace_note_comments; end if;
end $$;

notify pgrst, 'reload schema';

commit;
