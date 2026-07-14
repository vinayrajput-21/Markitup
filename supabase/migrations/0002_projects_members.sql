create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'reviewer' check (role in ('reviewer','editor')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid not null references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.invitations enable row level security;

-- a project is visible if you're a workspace member OR a project member
create function public.can_see_project(p uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p and public.is_workspace_member(pr.workspace_id)
  ) or exists (
    select 1 from public.project_members pm
    where pm.project_id = p and pm.user_id = auth.uid()
  );
$$;

create policy "see projects" on public.projects
  for select using (can_see_project(id));
create policy "members create projects" on public.projects
  for insert with check (public.is_workspace_member(workspace_id));

create policy "see project members" on public.project_members
  for select using (public.can_see_project(project_id));
create policy "ws members manage project members" on public.project_members
  for insert with check (
    exists (select 1 from public.projects pr
            where pr.id = project_id and public.is_workspace_member(pr.workspace_id))
  );

create policy "ws members see invitations" on public.invitations
  for select using (public.is_workspace_member(workspace_id));
create policy "ws members create invitations" on public.invitations
  for insert with check (public.is_workspace_member(workspace_id));
