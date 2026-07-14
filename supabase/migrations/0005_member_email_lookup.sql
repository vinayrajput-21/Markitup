-- app/app/actions.ts#addMemberByEmail looks up an existing profile by email
-- so it can add that user to the workspace immediately instead of creating a
-- pending invitation. The profiles RLS policies (0001) only allow reading
-- your OWN profile or a CO-MEMBER's profile -- so this lookup always failed
-- for the exact case the feature exists for (inviting someone who is not yet
-- in any shared workspace), silently falling through to the invitation path
-- every time.
--
-- Rather than widen the profiles table's own SELECT policy (which would let
-- any authenticated user read every profile's full row), expose a narrow
-- security-definer function that returns only the id for an exact email
-- match. This mirrors the is_workspace_member/is_workspace_owner helpers in
-- 0001, which already use this pattern to intentionally bypass RLS for one
-- specific, well-defined check.
create function public.find_profile_id_by_email(p_email text)
returns uuid
language sql security definer stable set search_path = public as $$
  select id from public.profiles where email = p_email limit 1;
$$;

grant execute on function public.find_profile_id_by_email(text) to authenticated;
