create table public.comment_attachments (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  file_path text not null,
  type text not null check (type in ('image','pdf')),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.comment_attachments enable row level security;

-- Visible/insertable if you can see the comment's mockup (via pin -> mockup).
create policy "see comment attachments" on public.comment_attachments
  for select using (
    exists (
      select 1 from public.comments c
      join public.pins pn on pn.id = c.pin_id
      where c.id = comment_id and public.can_see_pin(pn.mockup_id)
    )
  );
create policy "add comment attachments" on public.comment_attachments
  for insert with check (
    exists (
      select 1 from public.comments c
      join public.pins pn on pn.id = c.pin_id
      where c.id = comment_id and public.can_see_pin(pn.mockup_id)
    )
  );

-- private bucket for comment files; object path is '<projectId>/<file>'
insert into storage.buckets (id, name, public)
values ('comment-files', 'comment-files', false)
on conflict (id) do nothing;

create policy "read comment files" on storage.objects
  for select using (
    bucket_id = 'comment-files'
    and public.can_see_project(((storage.foldername(name))[1])::uuid)
  );
create policy "write comment files" on storage.objects
  for insert with check (
    bucket_id = 'comment-files'
    and public.can_see_project(((storage.foldername(name))[1])::uuid)
  );
