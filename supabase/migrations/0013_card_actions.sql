-- Share / archive / delete actions on project and file (mockup) cards.

-- Individual files can now be archived (hidden from the project, restorable
-- from the Archive page) in addition to projects.
alter table public.mockups add column archived_at timestamptz;

-- DELETE policies. There were none, so RLS silently blocked all deletes.
-- Cascades (0003/0004/0006/0007/0008/0011) clean up mockups, pins, comments,
-- attachments, share links, notifications and views for us.
create policy "members delete projects" on public.projects
  for delete using (public.is_workspace_member(workspace_id));

create policy "members delete mockups" on public.mockups
  for delete using (public.can_see_project(project_id));

-- Archiving a mockup is an UPDATE; mockups only had select/insert policies.
create policy "members update mockups" on public.mockups
  for update using (public.can_see_project(project_id));

-- Allow members to delete a project's storage objects so a deleted file/project
-- doesn't leave orphaned originals behind.
create policy "delete mockup objects" on storage.objects
  for delete using (
    bucket_id = 'mockups'
    and public.can_see_project(((storage.foldername(name))[1])::uuid)
  );
