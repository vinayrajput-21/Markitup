# Design: Collaboration & Folder Dashboard

Date: 2026-07-16
Status: Approved (design), pending implementation plan

## Overview

Five enhancements inspired by markup.io, delivered in four independently-shippable phases:

- **Phase 1 (quick wins):** (A) proper comment attribution — real author name + exact date/time; (B) a profile avatar menu + a "Your Profile" page to edit your display name.
- **Phase 2:** (C) in-app notifications (bell + list) for comments, invites, and shares, written wherever we already send an email.
- **Phase 3:** (D) "Recently viewed by" presence on the mockup viewer.
- **Phase 4:** (E) a folder-based dashboard redesign (folders group projects; project cards with counts; archive; filter/sort/search).

## Decisions (from brainstorming)

- **Folders group projects.** New `folders` layer above the existing `projects`; projects gain a nullable `folder_id`. Existing projects stay at the top level (folder_id null) until moved. Mockups still belong to projects.
- **Notifications = in-app + reuse email.** Every place that already sends an email also writes an in-app notification row. Brand-new-email invitees (no account yet) get only the email.
- **Presence = per mockup, on open.** A view is recorded (upserted) when a user opens a mockup.
- **"Your Profile" is minimal:** edit display name; email shown read-only; password change links to the existing `/forgot-password` flow; no avatar upload.

## Out of scope (explicit)

- **Live-URL website markups** (markup.io's "Enter a URL" that proxies a live site). This is a large standalone system (headless browser, live proxy, asset rewriting) and is deliberately excluded. The dashboard top bar is **Upload · New folder · Invite**, not a URL box.
- Real-time websocket presence/notifications (we use fetch-on-load + light polling).
- Avatar image uploads, password/email change UI beyond linking to the existing reset flow.
- Per-project presence (presence is mockup-level only).

## Existing architecture (context)

Data model today: `workspaces → workspace_members`, `profiles`, `projects → project_members`, `mockups → pins → comments`, `share_links`, `invitations`. RLS everywhere, with SECURITY DEFINER helpers (`can_see_project`, `is_workspace_member`, `find_profile_id_by_email`). Migrations live in `supabase/migrations/000N_*.sql`, applied via `node scripts/db-apply.mjs <file>`. Email module `lib/email/` (best-effort Resend). Server Actions return `{ error }` on failure. Tests: Vitest, mocking `@/lib/supabase/server` and `@/lib/email/send`.

New migrations are numbered in apply order, which is phase order: `0007_notifications.sql` (Phase 2), `0008_mockup_views.sql` (Phase 3), `0009_folders.sql` (Phase 4). Each is applied via `node scripts/db-apply.mjs <file>` when its phase is built. (Confirm the next free number at implementation time in case other migrations landed first.)

---

## Phase 1A — Comment attribution

**Problem:** A freshly-posted comment shows the optimistic placeholder "You" (`CommentThread.tsx:112`), and a comment from a profile with no `name` shows "Someone" (`app/app/mockups/[mockupId]/page.tsx` `authorName: c.profiles?.name ?? "Someone"`). Relative time is shown but there is no exact timestamp.

**Design:**
- Pass the current user's `{ id, name }` into `MockupViewer` (from the mockup page, which already has the authed user) → down to `CommentThread`. The optimistic comment in `post()` uses the real current-user name instead of `"You"`.
- Broaden the comments query in `page.tsx` to also select the author's `email`; compute `authorName = profile.name || emailLocalPart(email) || "Unknown"` (never "Someone"). Apply the same to the pin-list first-comment author.
- Add a `formatDateTime(iso)` helper in `lib/format.ts` (absolute, e.g. "Jul 16, 2026, 3:42 PM"). In `CommentRow`, the existing relative-time span gets a `title={formatDateTime(c.createdAt)}` so the exact time shows on hover.

**No schema change.** Testing: `lib/format.test.ts` covers `formatDateTime` + an `emailLocalPart` helper; a `CommentThread` test asserts a posted comment renders the current user's name (not "You").

## Phase 1B — Profile avatar menu + profile page

**Design:**
- `components/app/ProfileMenu.tsx` (client): an `Avatar` button (initials from name/email) that toggles a dropdown with **Your Profile** (link to `/app/profile`) and **Sign out** (calls existing `signOut`). Closes on outside-click (same pattern as the viewer's sort/zoom menus).
- Render `ProfileMenu` in the top-right of the main app header (dashboard) and the mockup viewer header (next to Share).
- `app/profile/page.tsx` under the app layout (`app/app/profile/page.tsx`): shows the user's email (read-only), a form to edit display name, and a "Change password" link to `/forgot-password`.
- Server action `updateProfileName(formData)` in `app/app/actions.ts`: validates a non-empty name, updates `profiles.name` for the current user AND `supabase.auth.updateUser({ data: { name } })` so both stay in sync; `revalidatePath` the app. Returns `{ error }` or `{}`.

**No schema change** (profiles.name already exists). Testing: an action test asserts `updateProfileName` rejects empty and updates on valid input (mocked Supabase).

## Phase 2C — Notifications (in-app + email)

**Schema (`notifications`):**
```
id uuid pk default gen_random_uuid()
user_id uuid not null references profiles(id)      -- recipient
actor_id uuid references profiles(id)              -- who caused it
type text not null check (type in ('comment','invite','share'))
mockup_id uuid references mockups(id) on delete cascade
project_id uuid references projects(id) on delete cascade
body text not null                                 -- rendered summary line
read_at timestamptz
created_at timestamptz not null default now()
```
RLS: `select`/`update` (mark read) only where `user_id = auth.uid()`. **Inserts happen for OTHER users**, which RLS would block, so creation goes through a SECURITY DEFINER function `create_notification(p_user_id, p_actor_id, p_type, p_mockup_id, p_project_id, p_body)` that verifies the caller `can_see_project(p_project_id)` before inserting (prevents spamming arbitrary users), mirroring the existing `find_profile_id_by_email` definer pattern.

**Write sites (all best-effort, never break the core action):**
- `addComment` — after the email loop, for each recipient (team except author) also call `create_notification(..., 'comment', mockupId, projectId, "<name> commented on <mockup>")`.
- `addMemberByEmail` / `inviteToProject` — for the existing-member branch (profile found), call `create_notification(..., 'invite'|'share', null|mockupId, projectId|null, "<inviter> invited you to <workspace/project>")`. New-email branch: email only.

**Server actions (`app/app/notifications-actions.ts`):**
- `getNotifications()` → recent N (e.g. 20) for the current user, joined to actor name, plus `unreadCount`.
- `markNotificationsRead()` → set `read_at = now()` where `user_id = auth.uid() and read_at is null`.

**UI:** `components/app/NotificationBell.tsx` (client) — bell icon with an unread-count badge; on click, opens a dropdown list (actor + body + relative time, linking to the mockup/project); opening triggers `markNotificationsRead()`. Fetches on mount and polls every ~30s (`setInterval`, cleared on unmount). Rendered in the app top bar next to `ProfileMenu`.

Testing: action tests for `getNotifications`/`markNotificationsRead` (mocked Supabase); `addComment`/invite tests extended to assert `create_notification` is attempted for the right recipients; best-effort (a notification failure never breaks the comment/invite — same try/catch guarantee as email).

## Phase 3D — "Recently viewed by" presence

**Schema (`mockup_views`):**
```
mockup_id uuid not null references mockups(id) on delete cascade
user_id uuid not null references profiles(id)
viewed_at timestamptz not null default now()
primary key (mockup_id, user_id)
```
RLS: `select` where `can_see_project` of the mockup's project; `insert`/`update` your own row where you can see the project. Recording uses an upsert (`on conflict (mockup_id, user_id) do update set viewed_at = now()`).

**Write:** server action `recordMockupView(mockupId)` (upsert), called from a `useEffect` on mount in the viewer (client) so it reflects real opens without slowing SSR. Best-effort.

**Read + UI:** the mockup page (server) fetches recent viewers (`mockup_views` join `profiles`, order by `viewed_at desc`, limit ~8, excluding no one) and passes them to `components/viewer/RecentViewers.tsx` (client): an overlapping avatar stack; clicking opens a "Recently viewed by" dropdown listing each viewer's name + relative time (matches the screenshot). Rendered in the viewer header.

Testing: action test for `recordMockupView` upsert; a `RecentViewers` render test (avatars + names). The current viewer records their own view; the dropdown reflects the passed-in list.

## Phase 4E — Folder dashboard

**Schema (`folders` + alter `projects`):**
```
create table folders (
  id uuid pk default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
alter table projects add column folder_id uuid references folders(id) on delete set null;
alter table projects add column archived_at timestamptz;
```
RLS on `folders`: select/insert/update/delete gated on `is_workspace_member(workspace_id)` (same visibility rule projects use). Deleting a folder sets its projects' `folder_id` to null (on delete set null) — projects are never destroyed by folder deletion.

**Server actions (`app/app/actions.ts` / a new `folders-actions.ts`):**
- `createFolder(name)`, `renameFolder(id, name)`, `deleteFolder(id)`
- `moveProjectToFolder(projectId, folderId | null)`
- `archiveProject(projectId)` / `unarchiveProject(projectId)` (set/clear `archived_at`)

**Dashboard redesign (`app/app/page.tsx`):**
- Top bar: **Upload** (existing mockup upload entry / "New project"), **New folder**, **Invite** (links to members).
- Grid at workspace root shows: **folder cards** (folder icon + name + project count) and **loose project cards** (folder_id null, not archived).
- Clicking a folder → `app/app/folders/[folderId]/page.tsx` showing that folder's projects (with a back-to-dashboard link and a breadcrumb).
- **Project card:** thumbnail (first mockup's signed URL, or a placeholder), name, "updated X ago", and counts — mockups, comments, resolved pins — like the screenshot (✓ / 💬 / 🖼).
- **Move to folder** and **Archive** actions on each project card (a small "⋯" menu).
- **Archive view** `app/app/archive/page.tsx` lists archived projects with **Restore**.
- **Filter / sort / search** on the grid, client-side over the fetched list (sort by updated/name; search by name).
- Sidebar (`AppSidebar`) nav updated to: **Dashboard · Team · Archive**.

**Counts:** a SQL view or SECURITY DEFINER RPC `project_stats(project_id)` returning `{ mockups, comments, resolved }`, or a single grouped query the dashboard runs per workspace. Chosen at plan time; must respect RLS (only projects the user can see).

Testing: action tests for `createFolder`/`moveProjectToFolder`/`archiveProject` (mocked Supabase, assert correct table writes and error handling); a dashboard render test for the folder/project card split (folders vs loose projects vs archived-excluded); RLS for `folders` verified by extending `scripts/rls-check.mjs` or a note that it reuses `is_workspace_member`.

---

## Cross-cutting requirements

- Every new best-effort side effect (notification write, view record) is wrapped so it never breaks the primary action, exactly like the email sends.
- All new tables have RLS enabled with tenant-isolation policies; cross-user inserts (notifications) go through a guarded SECURITY DEFINER function, never a broad insert policy.
- New Server Actions authenticate via the session and authorize via RLS / `can_see_project`; return values stay minimal (`{ error }` / typed payloads), no raw rows leaked.
- Follow existing UI conventions (theme CSS vars, `Avatar`, dropdown outside-click pattern, `btn-*`/`field` classes).
- Existing tests stay green; each new behavior gets a test. DB-backed RLS invariants for new tables are proven the way `scripts/rls-check.mjs`/`pins-check.mjs` prove the existing ones (or explicitly noted as reusing an already-proven helper).

## Migrations summary

- Phase 2 → `0007_notifications.sql`: `notifications` table + `create_notification` SECURITY DEFINER fn + RLS.
- Phase 3 → `0008_mockup_views.sql`: `mockup_views` table + RLS.
- Phase 4 → `0009_folders.sql`: `folders` table + `projects.folder_id` + `projects.archived_at` + folders RLS + `project_stats`.
(Phases 1A/1B need no migration.)

## Phasing / delivery

Phase 1 → 2 → 3 → 4, each independently shippable and mergeable. The plan groups tasks by phase; execution is continuous with per-task review, but any phase boundary is a safe stopping point.
