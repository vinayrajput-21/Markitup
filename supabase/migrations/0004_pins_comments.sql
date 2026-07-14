create table public.pins (
  id uuid primary key default gen_random_uuid(),
  mockup_id uuid not null references public.mockups(id) on delete cascade,
  page int not null default 0,
  x double precision not null check (x >= 0 and x <= 1),
  y double precision not null check (y >= 0 and y <= 1),
  number int not null,
  status text not null default 'active' check (status in ('active','resolved')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (mockup_id, number)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pins(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- assign the next sequential pin number per mockup; a per-mockup advisory
-- lock serializes concurrent inserts so numbering cannot race, and the
-- unique(mockup_id, number) constraint on public.pins is a backstop that
-- makes any residual race fail loudly instead of silently duplicating.
create function public.assign_pin_number()
returns trigger language plpgsql as $$
begin
  -- serialize concurrent inserts for the same mockup so numbering cannot race
  perform pg_advisory_xact_lock(hashtext(new.mockup_id::text));
  select coalesce(max(number), 0) + 1 into new.number
  from public.pins where mockup_id = new.mockup_id;
  return new;
end;
$$;

create trigger set_pin_number
  before insert on public.pins
  for each row execute function public.assign_pin_number();

-- project visibility for a pin, via its mockup
create function public.can_see_pin(m uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.mockups mk
    where mk.id = m and public.can_see_project(mk.project_id)
  );
$$;

alter table public.pins enable row level security;
alter table public.comments enable row level security;

create policy "see pins" on public.pins
  for select using (public.can_see_pin(mockup_id));
create policy "create pins" on public.pins
  for insert with check (public.can_see_pin(mockup_id) and created_by = auth.uid());
create policy "update pin status" on public.pins
  for update using (public.can_see_pin(mockup_id));

create policy "see comments" on public.comments
  for select using (
    exists (select 1 from public.pins p
            where p.id = pin_id and public.can_see_pin(p.mockup_id))
  );
create policy "create comments" on public.comments
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from public.pins p
                where p.id = pin_id and public.can_see_pin(p.mockup_id))
  );
