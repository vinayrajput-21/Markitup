create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,   -- recipient
  actor_id uuid references public.profiles(id) on delete set null,          -- who caused it
  type text not null check (type in ('comment','invite','share')),
  mockup_id uuid references public.mockups(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- You can only ever see and mark-read your own notifications.
create policy "see own notifications" on public.notifications
  for select using (user_id = auth.uid());
create policy "update own notifications" on public.notifications
  for update using (user_id = auth.uid());
-- NOTE: intentionally no INSERT policy. Rows are created only via
-- create_notification() below, which runs SECURITY DEFINER.

-- Guarded creator: you may only create a notification AS yourself, and only
-- for someone you already share a project (or, for workspace-level invites
-- with no project, a workspace) with. Any violation silently no-ops, which
-- suits the best-effort callers (they ignore the result).
create function public.create_notification(
  p_user_id uuid,
  p_actor_id uuid,
  p_type text,
  p_mockup_id uuid,
  p_project_id uuid,
  p_body text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_actor_id is distinct from auth.uid() then
    return;
  end if;
  if p_user_id = auth.uid() then
    return; -- never notify yourself
  end if;
  if p_project_id is not null then
    if not public.can_see_project(p_project_id) then return; end if;
  else
    if not exists (
      select 1 from public.workspace_members m1
      join public.workspace_members m2 on m1.workspace_id = m2.workspace_id
      where m1.user_id = auth.uid() and m2.user_id = p_user_id
    ) then
      return;
    end if;
  end if;
  insert into public.notifications (user_id, actor_id, type, mockup_id, project_id, body)
  values (p_user_id, p_actor_id, p_type, p_mockup_id, p_project_id, p_body);
end;
$$;

grant execute on function public.create_notification(uuid,uuid,text,uuid,uuid,text) to authenticated;
