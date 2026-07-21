-- Allow deleting comment threads. There were no DELETE policies on pins or
-- comments, so RLS silently blocked all deletes. Deleting a pin cascades to its
-- comments (0004) and comment_attachments (0011).
create policy "delete pins" on public.pins
  for delete using (public.can_see_pin(mockup_id));

create policy "delete comments" on public.comments
  for delete using (
    exists (select 1 from public.pins p where p.id = pin_id and public.can_see_pin(p.mockup_id))
  );
