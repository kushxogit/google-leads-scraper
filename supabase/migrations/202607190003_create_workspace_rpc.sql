begin;

create or replace function public.create_team_workspace(p_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare created_workspace public.workspaces;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Workspace name is required';
  end if;

  insert into public.workspaces (name, type, created_by)
  values (trim(p_name), 'team', auth.uid())
  returning * into created_workspace;

  return created_workspace;
end;
$$;

grant execute on function public.create_team_workspace(text) to authenticated;

commit;
