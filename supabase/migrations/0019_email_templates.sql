-- Editable transactional email templates, per workspace.
-- Two keys today: 'client_invite' (Send to client) and 'team_invite' (invite a teammate).
create table if not exists public.email_templates (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key text not null check (key in ('client_invite', 'team_invite')),
  subject text not null,
  message text not null,
  button_label text not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, key)
);

alter table public.email_templates enable row level security;

-- Any workspace member may read the templates (needed to render the settings UI).
create policy "members read email templates" on public.email_templates
  for select using (public.is_workspace_member(workspace_id));

-- Only owners/admins may create or change them.
create policy "admins insert email templates" on public.email_templates
  for insert with check (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = email_templates.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );
create policy "admins update email templates" on public.email_templates
  for update using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = email_templates.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );
