-- Let you read the profile of anyone who shares a PROJECT with you (not just a
-- workspace). Fixes comment authors showing "Unknown" and missing @mentions for
-- clients invited to a single project. can_see_project is SECURITY DEFINER, so
-- this does not recurse into profiles' own RLS.
create policy "read co-project-member profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.project_members pm
      where pm.user_id = profiles.id and public.can_see_project(pm.project_id)
    )
  );
