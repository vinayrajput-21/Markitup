create table public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.projects add column folder_id uuid references public.folders(id) on delete set null;
alter table public.projects add column archived_at timestamptz;

-- projects gained folder_id + archived_at above. RLS on projects (0002) only
-- had SELECT + INSERT, so folder-move and archive UPDATEs would be silently
-- denied (0 rows, no error) and the actions would appear to succeed while
-- persisting nothing. Add the missing UPDATE policy.
create policy "members update projects" on public.projects
  for update using (public.is_workspace_member(workspace_id));

alter table public.folders enable row level security;

create policy "see folders" on public.folders
  for select using (public.is_workspace_member(workspace_id));
create policy "members create folders" on public.folders
  for insert with check (public.is_workspace_member(workspace_id));
create policy "members update folders" on public.folders
  for update using (public.is_workspace_member(workspace_id));
create policy "members delete folders" on public.folders
  for delete using (public.is_workspace_member(workspace_id));

-- Card counts for a project, RLS-respecting: returns no row unless the caller
-- can see the project (callers then treat missing as zeros).
create function public.project_stats(p uuid)
returns table (mockups int, comments int, resolved int)
language sql security definer stable set search_path = public as $$
  select
    (select count(*) from public.mockups m where m.project_id = p)::int,
    (select count(*) from public.comments c
       join public.pins pn on pn.id = c.pin_id
       join public.mockups m on m.id = pn.mockup_id
       where m.project_id = p)::int,
    (select count(*) from public.pins pn
       join public.mockups m on m.id = pn.mockup_id
       where m.project_id = p and pn.status = 'resolved')::int
  where public.can_see_project(p);
$$;

grant execute on function public.project_stats(uuid) to authenticated;
