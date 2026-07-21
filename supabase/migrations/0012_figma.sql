-- Figma prototype review surface. A figma mockup stores the rendered Comment-mode
-- PNG in file_path (like any image) plus the metadata needed for Browse/sync.
alter table public.mockups
  add column if not exists figma_file_key text,
  add column if not exists figma_node_id text,
  add column if not exists figma_embed_url text;

-- Per-workspace Figma connection. The personal access token is stored encrypted
-- (AES-256-GCM, app key from env) and only ever decrypted server-side.
create table public.workspace_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  figma_token_cipher text,
  figma_token_iv text,
  connected_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_integrations enable row level security;

-- Any workspace member may read the row (only ciphertext, useless without the app
-- key) so they can import; only owners/admins may set or change the token.
create policy "members read integration" on public.workspace_integrations
  for select using (public.is_workspace_member(workspace_id));
create policy "admins set integration" on public.workspace_integrations
  for insert with check (
    exists (select 1 from public.workspace_members m
            where m.workspace_id = workspace_integrations.workspace_id
              and m.user_id = auth.uid() and m.role in ('owner','admin')));
create policy "admins update integration" on public.workspace_integrations
  for update using (
    exists (select 1 from public.workspace_members m
            where m.workspace_id = workspace_integrations.workspace_id
              and m.user_id = auth.uid() and m.role in ('owner','admin')));
