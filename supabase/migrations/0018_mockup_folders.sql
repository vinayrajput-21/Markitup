-- Folders INSIDE a project: nestable sub-folders that hold mockups.
-- (Distinct from the workspace-level `folders` table that groups projects.)

create table public.mockup_folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.mockup_folders(id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- A mockup can live in a folder; deleting the folder moves its files to the
-- project root (set null) rather than deleting them. Sub-folders cascade.
alter table public.mockups add column folder_id uuid references public.mockup_folders(id) on delete set null;

create index mockup_folders_project_idx on public.mockup_folders (project_id, parent_id);
create index mockups_folder_idx on public.mockups (folder_id);

alter table public.mockup_folders enable row level security;
create policy "manage mockup folders" on public.mockup_folders
  for all using (public.can_see_project(project_id))
  with check (public.can_see_project(project_id));
