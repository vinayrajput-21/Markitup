create table public.mockup_views (
  mockup_id uuid not null references public.mockups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (mockup_id, user_id)
);
create index mockup_views_recent on public.mockup_views (mockup_id, viewed_at desc);

alter table public.mockup_views enable row level security;

-- You can see who viewed a mockup you can see; you can record/refresh only your
-- own view. can_see_pin(mockup_id) checks the mockup's project visibility.
create policy "see mockup views" on public.mockup_views
  for select using (public.can_see_pin(mockup_id));
create policy "record own view" on public.mockup_views
  for insert with check (user_id = auth.uid() and public.can_see_pin(mockup_id));
create policy "refresh own view" on public.mockup_views
  for update using (user_id = auth.uid() and public.can_see_pin(mockup_id));
