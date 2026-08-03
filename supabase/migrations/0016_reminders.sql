-- Client feedback reminders.
-- Per-workspace settings + a schedule row per (client, mockup) that was sent via
-- "Send to client". A daily cron sends the next follow-up until the client leaves
-- feedback or the max count is reached.

create table public.reminder_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  enabled boolean not null default false,
  days_between int not null default 3 check (days_between between 1 and 30),
  max_count int not null default 3 check (max_count between 1 and 10),
  stop_on_feedback boolean not null default true,
  weekdays_only boolean not null default true,
  cc_me boolean not null default false,
  notify_never boolean not null default true,
  subject text not null default 'Any thoughts on "{{page_name}}"?',
  message text not null default 'Just checking in — {{sender}} shared "{{page_name}}" with you and would love your feedback. It only takes a minute to add your comments.',
  button_label text not null default 'Leave feedback',
  updated_at timestamptz not null default now()
);
alter table public.reminder_settings enable row level security;
create policy "manage reminder settings" on public.reminder_settings
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create table public.reminder_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  mockup_id uuid references public.mockups(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  share_token text,
  created_by uuid references public.profiles(id),
  baseline_comment_count int not null default 0,
  sent_count int not null default 0,
  last_sent_at timestamptz,
  next_due_at timestamptz not null,
  status text not null default 'active' check (status in ('active','responded','done','stopped')),
  created_at timestamptz not null default now()
);
alter table public.reminder_schedules enable row level security;
create index reminder_schedules_due_idx on public.reminder_schedules (status, next_due_at);
create policy "manage reminder schedules" on public.reminder_schedules
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
