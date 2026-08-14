-- Guest commenting: let logged-out visitors leave feedback on PUBLIC share links
-- using just a display name. Guest pins/comments have a null author_id and a
-- stored author_name. All guest writes go exclusively through SECURITY DEFINER
-- RPCs that re-validate the token is public and scope every write to that
-- token's mockup — we add NO blanket anonymous RLS insert policies.

-- 1) Schema: allow guest authorship ----------------------------------------
alter table public.comments alter column author_id drop not null;
alter table public.comments add column if not exists author_name text;
alter table public.comments
  add constraint comments_author_present
  check (author_id is not null or author_name is not null);

alter table public.pins alter column created_by drop not null;

-- 2) Reads: expose a public link's mockup + threads without login -----------
-- Only ever returns rows for a 'public' token; restricted/unknown => nothing.
create or replace function public.guest_share_mockup(p_token text)
returns table (mockup_id uuid, project_id uuid, name text, file_path text,
               type text, figma_file_key text, figma_node_id text)
language sql security definer stable set search_path = public as $$
  select mk.id, mk.project_id, mk.name, mk.file_path, mk.type,
         mk.figma_file_key, mk.figma_node_id
  from public.share_links sl
  join public.mockups mk on mk.id = sl.mockup_id
  where sl.token = p_token and sl.visibility = 'public';
$$;

create or replace function public.guest_share_pins(p_token text)
returns jsonb
language sql security definer stable set search_path = public as $$
  with tok as (
    select sl.mockup_id
    from public.share_links sl
    where sl.token = p_token and sl.visibility = 'public'
  )
  select coalesce(jsonb_agg(pin order by (pin->>'number')::int), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', p.id, 'x', p.x, 'y', p.y, 'number', p.number, 'status', p.status,
      'comments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id,
          'body', c.body,
          'parentCommentId', c.parent_comment_id,
          'createdAt', c.created_at,
          'authorName', coalesce(c.author_name, pr.name, 'Someone')
        ) order by c.created_at)
        from public.comments c
        left join public.profiles pr on pr.id = c.author_id
        where c.pin_id = p.id
      ), '[]'::jsonb)
    ) as pin
    from public.pins p
    join tok on tok.mockup_id = p.mockup_id
  ) s;
$$;

-- 3) Writes: guest pin + comment, both gated on a public token -------------
create or replace function public.guest_create_pin(
  p_token text, p_x double precision, p_y double precision)
returns table (id uuid, number int)
language plpgsql security definer set search_path = public as $$
declare v_mockup uuid;
begin
  select sl.mockup_id into v_mockup
  from public.share_links sl
  where sl.token = p_token and sl.visibility = 'public';
  if v_mockup is null then raise exception 'invalid or non-public share token'; end if;
  if p_x < 0 or p_x > 1 or p_y < 0 or p_y > 1 then raise exception 'pin out of bounds'; end if;

  return query
  insert into public.pins (mockup_id, x, y, created_by)
  values (v_mockup, p_x, p_y, null)
  returning pins.id, pins.number;
end;
$$;

create or replace function public.guest_add_comment(
  p_token text, p_pin_id uuid, p_body text, p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_mockup uuid; v_id uuid; v_name text;
begin
  select sl.mockup_id into v_mockup
  from public.share_links sl
  where sl.token = p_token and sl.visibility = 'public';
  if v_mockup is null then raise exception 'invalid or non-public share token'; end if;

  -- the pin must belong to this token's mockup
  if not exists (
    select 1 from public.pins p where p.id = p_pin_id and p.mockup_id = v_mockup
  ) then raise exception 'pin does not belong to this shared mockup'; end if;

  v_name := nullif(btrim(p_name), '');
  if v_name is null then raise exception 'a name is required'; end if;
  if p_body is null or length(btrim(p_body)) = 0 or length(p_body) > 10000 then
    raise exception 'invalid comment body';
  end if;

  insert into public.comments (pin_id, author_id, author_name, body)
  values (p_pin_id, null, left(v_name, 60), p_body)
  returning id into v_id;
  return v_id;
end;
$$;

-- 4) Grants: the public viewer runs as `anon` (no session) -----------------
grant execute on function public.resolve_share_link(text) to anon;
grant execute on function public.guest_share_mockup(text) to anon, authenticated;
grant execute on function public.guest_share_pins(text) to anon, authenticated;
grant execute on function public.guest_create_pin(text, double precision, double precision) to anon, authenticated;
grant execute on function public.guest_add_comment(text, uuid, text, text) to anon, authenticated;
