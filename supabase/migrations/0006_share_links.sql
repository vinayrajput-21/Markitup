-- Per-mockup share links. One link per mockup; visibility is 'restricted'
-- (only project/workspace members) or 'public' (any signed-in user with the
-- link is auto-granted reviewer access to the project on first visit).

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  mockup_id uuid not null references public.mockups(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  visibility text not null default 'restricted' check (visibility in ('public', 'restricted')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (mockup_id)
);

alter table public.share_links enable row level security;

-- anyone who can see the mockup (via project visibility) can read/create/toggle its link
create policy "see share link" on public.share_links
  for select using (public.can_see_pin(mockup_id));
create policy "create share link" on public.share_links
  for insert with check (public.can_see_pin(mockup_id) and created_by = auth.uid());
create policy "update share link" on public.share_links
  for update using (public.can_see_pin(mockup_id));

-- Resolve a link by token, bypassing RLS so a not-yet-member can look up a
-- public link. Returns nothing for an unknown token.
create function public.resolve_share_link(p_token text)
returns table (mockup_id uuid, project_id uuid, visibility text)
language sql security definer stable set search_path = public as $$
  select sl.mockup_id, mk.project_id, sl.visibility
  from public.share_links sl
  join public.mockups mk on mk.id = sl.mockup_id
  where sl.token = p_token;
$$;
grant execute on function public.resolve_share_link(text) to authenticated;

-- Redeem a link for the current user: if the link is public, grant them
-- reviewer membership on the project (idempotent). Restricted links grant
-- nothing here (the caller only sees the mockup if already a member).
-- Returns the mockup id for any valid token, else null.
create function public.join_project_via_share(p_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_mockup uuid;
  v_project uuid;
  v_vis text;
begin
  select sl.mockup_id, mk.project_id, sl.visibility
    into v_mockup, v_project, v_vis
  from public.share_links sl
  join public.mockups mk on mk.id = sl.mockup_id
  where sl.token = p_token;

  if v_mockup is null then
    return null;
  end if;

  if v_vis = 'public' then
    insert into public.project_members (project_id, user_id, role)
    values (v_project, auth.uid(), 'reviewer')
    on conflict (project_id, user_id) do nothing;
  end if;

  return v_mockup;
end;
$$;
grant execute on function public.join_project_via_share(text) to authenticated;
