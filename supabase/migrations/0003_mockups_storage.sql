create table public.mockups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  type text not null default 'image' check (type in ('image','pdf','figma')),
  file_path text not null,
  page_count int not null default 1,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.mockups enable row level security;

create policy "see mockups" on public.mockups
  for select using (public.can_see_project(project_id));
create policy "members add mockups" on public.mockups
  for insert with check (public.can_see_project(project_id));

-- private storage bucket for originals
insert into storage.buckets (id, name, public)
values ('mockups', 'mockups', false)
on conflict (id) do nothing;

-- object path is '<projectId>/<file>'; gate on project visibility
create policy "read mockup objects" on storage.objects
  for select using (
    bucket_id = 'mockups'
    and public.can_see_project(((storage.foldername(name))[1])::uuid)
  );
create policy "write mockup objects" on storage.objects
  for insert with check (
    bucket_id = 'mockups'
    and public.can_see_project(((storage.foldername(name))[1])::uuid)
  );
