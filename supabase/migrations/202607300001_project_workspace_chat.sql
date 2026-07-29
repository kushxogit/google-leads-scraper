begin;

create table public.project_chat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.task_projects(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null default '' check (char_length(body) <= 12000),
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(body)) > 0 or jsonb_array_length(attachments) > 0)
);
create index project_chat_messages_feed_idx on public.project_chat_messages (workspace_id, project_id, created_at);

create table public.project_chat_saves (
  message_id uuid not null references public.project_chat_messages(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.task_projects(id) on delete cascade,
  saved_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, saved_by)
);
create index project_chat_saves_project_idx on public.project_chat_saves (workspace_id, project_id, created_at desc);

create or replace function public.validate_project_chat_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.task_projects where id = new.project_id and workspace_id = new.workspace_id) then
    raise exception 'Chat project must belong to the workspace';
  end if;
  return new;
end; $$;
create trigger project_chat_messages_validate before insert or update on public.project_chat_messages
for each row execute function public.validate_project_chat_message();

create or replace function public.validate_project_chat_save()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.project_chat_messages where id = new.message_id and workspace_id = new.workspace_id and project_id = new.project_id) then
    raise exception 'Saved message must belong to the selected project';
  end if;
  return new;
end; $$;
create trigger project_chat_saves_validate before insert or update on public.project_chat_saves
for each row execute function public.validate_project_chat_save();

create trigger project_chat_messages_updated_at before update on public.project_chat_messages
for each row execute function public.set_updated_at();

alter table public.project_chat_messages enable row level security;
alter table public.project_chat_saves enable row level security;
create policy "Members manage project chat messages" on public.project_chat_messages for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id) and author_id = auth.uid());
create policy "Members manage saved project chat messages" on public.project_chat_saves for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id) and saved_by = auth.uid());

insert into storage.buckets (id, name, public) values ('project-chat-files', 'project-chat-files', false)
on conflict (id) do update set public = false;
create policy "Members read project chat files" on storage.objects for select to authenticated
using (bucket_id = 'project-chat-files' and public.can_access_workspace_storage_path(name));
create policy "Members upload project chat files" on storage.objects for insert to authenticated
with check (bucket_id = 'project-chat-files' and public.can_access_workspace_storage_path(name));
create policy "Members delete project chat files" on storage.objects for delete to authenticated
using (bucket_id = 'project-chat-files' and public.can_access_workspace_storage_path(name));

alter table public.project_chat_messages replica identity full;
alter table public.project_chat_saves replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_chat_messages') then
    alter publication supabase_realtime add table public.project_chat_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_chat_saves') then
    alter publication supabase_realtime add table public.project_chat_saves;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
