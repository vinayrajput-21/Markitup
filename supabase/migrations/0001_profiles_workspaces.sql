-- profiles mirror auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- create a profile automatically when an auth user is created
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- membership helper avoids recursive RLS lookups
create function public.is_workspace_member(ws uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- profiles: you can read your own + anyone in a shared workspace; write only your own
create policy "read own profile" on public.profiles
  for select using (id = auth.uid());
create policy "read co-member profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.workspace_members m1
      join public.workspace_members m2 on m1.workspace_id = m2.workspace_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );
create policy "update own profile" on public.profiles
  for update using (id = auth.uid());

-- workspaces: members can read; any authed user can create; owner can update
create policy "members read workspace" on public.workspaces
  for select using (public.is_workspace_member(id));
create policy "authed create workspace" on public.workspaces
  for insert with check (owner_id = auth.uid());
create policy "owner update workspace" on public.workspaces
  for update using (owner_id = auth.uid());

-- workspace_members: members can read the roster; owners/admins manage
create policy "members read roster" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));
create policy "self join via owner insert" on public.workspace_members
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid() and m.role in ('owner','admin')
    )
  );
