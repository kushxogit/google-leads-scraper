begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  updated_at timestamptz not null default now()
);

create or replace function public.sync_profile_from_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, updated_at)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    now()
  )
  on conflict (id) do update set full_name = excluded.full_name, email = excluded.email, updated_at = now();
  return new;
end; $$;

insert into public.profiles (id, full_name, email)
select id, coalesce(nullif(trim(raw_user_meta_data ->> 'full_name'), ''), nullif(trim(raw_user_meta_data ->> 'name'), ''), split_part(coalesce(email, ''), '@', 1)), email
from auth.users
on conflict (id) do update set full_name = excluded.full_name, email = excluded.email, updated_at = now();

drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_profile_from_auth_user();

alter table public.profiles enable row level security;

create or replace function public.shares_workspace_with(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user_id = auth.uid() or exists (
    select 1 from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user_id
  );
$$;
grant execute on function public.shares_workspace_with(uuid) to authenticated;

create policy "Users can view profiles in shared workspaces" on public.profiles for select to authenticated using (public.shares_workspace_with(id));
create policy "Users can update their own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.get_workspace_members(p_workspace_id uuid)
returns table (id uuid, full_name text, email text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_workspace_member(p_workspace_id) then raise exception 'Access denied'; end if;
  return query
  select p.id, p.full_name, p.email
  from public.workspace_members wm
  join public.profiles p on p.id = wm.user_id
  where wm.workspace_id = p_workspace_id
  order by coalesce(p.full_name, p.email), p.id;
end; $$;
grant execute on function public.get_workspace_members(uuid) to authenticated;

create or replace function public.bulk_update_leads(
  p_workspace_id uuid,
  p_lead_ids uuid[],
  p_status text default null,
  p_assigned_to uuid default null,
  p_delete boolean default false
)
returns integer language plpgsql security definer set search_path = public as $$
declare changed_count integer;
begin
  if not public.is_workspace_member(p_workspace_id) then raise exception 'Access denied'; end if;
  if coalesce(array_length(p_lead_ids, 1), 0) = 0 then return 0; end if;
  if p_delete then
    delete from public.leads where workspace_id = p_workspace_id and id = any(p_lead_ids);
  else
    if p_status is null and p_assigned_to is null then raise exception 'Choose a bulk action'; end if;
    update public.leads
    set status = coalesce(p_status, status), assigned_to = coalesce(p_assigned_to, assigned_to), updated_at = now()
    where workspace_id = p_workspace_id and id = any(p_lead_ids);
  end if;
  get diagnostics changed_count = row_count;
  return changed_count;
end; $$;
grant execute on function public.bulk_update_leads(uuid, uuid[], text, uuid, boolean) to authenticated;

commit;
