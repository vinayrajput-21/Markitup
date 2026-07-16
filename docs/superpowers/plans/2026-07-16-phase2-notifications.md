# Phase 2 — In-App Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** In-app notifications (bell + list) for comments, invites, and shares — written wherever we already send an email, delivered via a guarded SECURITY DEFINER function so no user can notify a stranger.

**Architecture:** A `notifications` table with RLS (you see/update only your own). Rows are created only through `create_notification(...)`, a SECURITY DEFINER function that no-ops unless the caller is acting as themselves and shares a project/workspace with the recipient. The existing email write-sites (`addComment`, `addMemberByEmail`, `inviteToProject`) also call this function, best-effort. A `NotificationBell` client component polls `getNotifications`, shows an unread badge, and marks read on open.

**Tech Stack:** Next.js 16 (Server Actions), React 19, Supabase (`@supabase/ssr`), Postgres RLS/PLpgSQL, Vitest + Testing Library.

## Global Constraints

- Notification writes are best-effort: wrapped so a failure NEVER breaks the comment/invite (same guarantee as email). `create_notification` returns void and silently no-ops on any authorization failure.
- Inserts happen ONLY via `create_notification` (SECURITY DEFINER). The table has NO insert RLS policy; direct client inserts are blocked.
- The function gates every insert: `p_actor_id = auth.uid()` AND (project set → `can_see_project(p_project_id)`; project null → caller shares a workspace with the recipient). This mirrors the proven `find_profile_id_by_email` / `is_workspace_member` definer pattern.
- Server Actions authenticate via session, return `{ error }` / typed payloads, leak no raw rows.
- Migration `0007_notifications.sql` is **applied to the cloud DB at deploy time** (`node scripts/db-apply.mjs supabase/migrations/0007_notifications.sql`) — NOT during this build. Unit tests mock Supabase, so they pass without the migration applied. (Confirm 0007 is the next free number when building.)
- TS-affecting tasks: run `npx tsc --noEmit -p .` before commit (Vitest strips types). Run `npm run build` on the wiring task. Existing 46 tests stay green.

---

### Task 1: Migration — notifications table + guarded create function

**Files:**
- Create: `supabase/migrations/0007_notifications.sql`

**Interfaces:**
- Produces (DB): table `public.notifications`; function `public.create_notification(p_user_id uuid, p_actor_id uuid, p_type text, p_mockup_id uuid, p_project_id uuid, p_body text) returns void`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0007_notifications.sql`:

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,   -- recipient
  actor_id uuid references public.profiles(id) on delete set null,          -- who caused it
  type text not null check (type in ('comment','invite','share')),
  mockup_id uuid references public.mockups(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- You can only ever see and mark-read your own notifications.
create policy "see own notifications" on public.notifications
  for select using (user_id = auth.uid());
create policy "update own notifications" on public.notifications
  for update using (user_id = auth.uid());
-- NOTE: intentionally no INSERT policy. Rows are created only via
-- create_notification() below, which runs SECURITY DEFINER.

-- Guarded creator: you may only create a notification AS yourself, and only
-- for someone you already share a project (or, for workspace-level invites
-- with no project, a workspace) with. Any violation silently no-ops, which
-- suits the best-effort callers (they ignore the result).
create function public.create_notification(
  p_user_id uuid,
  p_actor_id uuid,
  p_type text,
  p_mockup_id uuid,
  p_project_id uuid,
  p_body text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_actor_id is distinct from auth.uid() then
    return;
  end if;
  if p_user_id = auth.uid() then
    return; -- never notify yourself
  end if;
  if p_project_id is not null then
    if not public.can_see_project(p_project_id) then return; end if;
  else
    if not exists (
      select 1 from public.workspace_members m1
      join public.workspace_members m2 on m1.workspace_id = m2.workspace_id
      where m1.user_id = auth.uid() and m2.user_id = p_user_id
    ) then
      return;
    end if;
  end if;
  insert into public.notifications (user_id, actor_id, type, mockup_id, project_id, body)
  values (p_user_id, p_actor_id, p_type, p_mockup_id, p_project_id, p_body);
end;
$$;

grant execute on function public.create_notification(uuid,uuid,text,uuid,uuid,text) to authenticated;
```

- [ ] **Step 2: Sanity-check the SQL parses (no DB apply here)**

There is no local Postgres in this build and the migration is applied at deploy. Verify the file is syntactically well-formed by eye against the sibling migrations (`0004_pins_comments.sql`, `0005_member_email_lookup.sql`) — same `security definer set search_path = public` idiom, same `grant execute ... to authenticated`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_notifications.sql
git commit -m "feat(db): notifications table + guarded create_notification function (migration)"
```

---

### Task 2: Write a notification when a comment is posted

**Files:**
- Modify: `app/app/mockups/[mockupId]/actions.ts` (`addComment`)
- Modify: `app/app/mockups/comment-notify.test.ts`

**Interfaces:**
- Consumes (DB RPC): `create_notification(...)` via `supabase.rpc("create_notification", {...})`.
- The recipient lookup in `addComment` must also carry each recipient's profile `id` (today it stores only `{ name, email }`).

- [ ] **Step 1: Extend the test to assert a notification RPC per recipient**

In `app/app/mockups/comment-notify.test.ts`, the existing Supabase mock returns members with `profiles.id`. Add an `rpc` spy to the mocked client and a test asserting it is called for each non-author recipient. Update the `createServerSupabase` mock object to include:

```ts
    rpc: rpcMock,
```
where at the top of the file you add:
```ts
const rpcMock = vi.fn().mockResolvedValue({ error: null });
```
and reset it in `beforeEach` (`rpcMock.mockClear()`). Then add:

```ts
it("creates an in-app notification for each non-author recipient", async () => {
  const { addComment } = await import("./[mockupId]/actions");
  await addComment("m1", "pin1", "Please fix the header");
  const notified = rpcMock.mock.calls
    .filter((c) => c[0] === "create_notification")
    .map((c) => c[1].p_user_id)
    .sort();
  expect(notified).toEqual(["u2", "u3"]); // team + client, not the author u1
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/app/mockups/comment-notify.test.ts`
Expected: FAIL — `create_notification` never called.

- [ ] **Step 3: Carry recipient ids and call `create_notification`**

In `app/app/mockups/[mockupId]/actions.ts` `addComment`, inside the existing best-effort `try` block, change the recipient map to carry `id`, and after the email `sendEmail` loop add the notification call. Specifically:

(a) Change the recipient Map type/population from `{ name, email }` to include `id`:
```ts
      const recipients = new Map<string, { id: string; name: string; email: string }>();
      for (const row of [...(wm ?? []), ...(pm ?? [])]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = (row as any).profiles;
        if (p?.id && p.id !== author.id && p.email) {
          recipients.set(p.email, { id: p.id, name: p.name ?? "there", email: p.email });
        }
      }
```

(b) In the `for (const r of recipients.values())` loop, after the `await sendEmail(...)` line, add the notification write:
```ts
        await supabase.rpc("create_notification", {
          p_user_id: r.id,
          p_actor_id: author.id,
          p_type: "comment",
          p_mockup_id: mockupId,
          p_project_id: projectId ?? null,
          p_body: `${commenterName} commented on ${mk.name as string}`,
        });
```
(Still inside the surrounding `try/catch`, so a notification failure can't break the comment.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/app/mockups/comment-notify.test.ts`
Expected: PASS.

- [ ] **Step 5: tsc + full suite + commit**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: clean; all pass.

```bash
git add app/app/mockups/[mockupId]/actions.ts app/app/mockups/comment-notify.test.ts
git commit -m "feat(notifications): notify the team in-app when a comment is posted"
```

---

### Task 3: Write a notification when someone is invited/shared

**Files:**
- Modify: `app/app/actions.ts` (`addMemberByEmail` — existing-member branch)
- Modify: `app/app/mockups/[mockupId]/share-actions.ts` (`inviteToProject` — existing-member branch)
- Modify: `app/app/invite-email.test.ts`
- Modify: `app/app/mockups/invite-project-email.test.ts`

**Interfaces:**
- Consumes: `create_notification` RPC.

- [ ] **Step 1: Extend the workspace-invite test**

In `app/app/invite-email.test.ts`, add an `rpc` spy to the mocked client (`const rpcMock = vi.fn().mockResolvedValue({ error: null })`, include `rpc: rpcMock` in the mock, clear in `beforeEach`). The existing test covers the NEW-email branch (no profile → no notification, email only). Add a test for the existing-member branch: make the `find_profile_id_by_email` rpc return a profile id and assert a `create_notification` of type `invite` is attempted for that user.

> Note: `find_profile_id_by_email` is itself called via `supabase.rpc(...)` in this code. In the mock, `rpc` must return the profile id for the `"find_profile_id_by_email"` call and `{ error: null }` for `"create_notification"`. Implement `rpcMock` as: `vi.fn(async (name) => name === "find_profile_id_by_email" ? { data: "u9" } : { error: null })` in this new test's scenario. Assert one of the `rpcMock` calls is `["create_notification", expect.objectContaining({ p_user_id: "u9", p_type: "invite" })]`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/app/invite-email.test.ts`
Expected: FAIL — no `create_notification` call.

- [ ] **Step 3: Notify in `addMemberByEmail` (existing-member branch)**

In `app/app/actions.ts` `addMemberByEmail`, in the `if (profileId) { ... }` branch, after the `workspace_members` insert succeeds and inside the existing best-effort email `try`, add (using the already-computed `inviterName` and `ws`):
```ts
      await supabase.rpc("create_notification", {
        p_user_id: profileId,
        p_actor_id: userData.user!.id,
        p_type: "invite",
        p_mockup_id: null,
        p_project_id: null,
        p_body: `${inviterName} added you to ${ws.name}`,
      });
```

- [ ] **Step 4: Notify in `inviteToProject` (existing-member branch)**

In `app/app/mockups/[mockupId]/share-actions.ts` `inviteToProject`, in the `if (profileId) { ... }` branch, inside the best-effort email `try`, add:
```ts
      await supabase.rpc("create_notification", {
        p_user_id: profileId,
        p_actor_id: userData.user!.id,
        p_type: "share",
        p_mockup_id: mockupId,
        p_project_id: projectId,
        p_body: `${inviterName} shared "${workspaceName}" with you`,
      });
```

- [ ] **Step 5: Extend the project-invite test**

In `app/app/mockups/invite-project-email.test.ts`, add the `rpc` spy and assert the existing-member branch attempts a `create_notification` of type `share` for the found profile id. Follow the same `rpcMock` shape as Step 1 (return the profile id for `find_profile_id_by_email`, `{ error: null }` for `create_notification`).

- [ ] **Step 6: Run tests, tsc, full suite, commit**

Run: `npx vitest run app/app/invite-email.test.ts app/app/mockups/invite-project-email.test.ts && npx tsc --noEmit -p . && npx vitest run`
Expected: all pass; tsc clean.

```bash
git add app/app/actions.ts app/app/mockups/[mockupId]/share-actions.ts app/app/invite-email.test.ts app/app/mockups/invite-project-email.test.ts
git commit -m "feat(notifications): notify existing users on workspace/project invite"
```

---

### Task 4: getNotifications + markNotificationsRead actions

**Files:**
- Create: `app/app/notifications-actions.ts`
- Create: `app/app/notifications-actions.test.ts`

**Interfaces:**
- Produces:
  - `getNotifications(): Promise<{ items: NotificationItem[]; unreadCount: number }>` where `NotificationItem = { id: string; type: string; body: string; mockupId: string | null; readAt: string | null; createdAt: string; actorName: string }`.
  - `markNotificationsRead(): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `app/app/notifications-actions.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const rows = [
  { id: "n1", type: "comment", body: "Jane commented on Home", mockup_id: "m1", read_at: null, created_at: "2026-07-16T10:00:00Z", actor: { name: "Jane" } },
  { id: "n2", type: "invite", body: "Ravi added you", mockup_id: null, read_at: "2026-07-16T09:00:00Z", created_at: "2026-07-16T09:00:00Z", actor: { name: "Ravi" } },
];
const orderMock = vi.fn().mockResolvedValue({ data: rows });
const updateEq2 = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: orderMock }) }) }),
      update: () => ({ eq: () => ({ is: updateEq2 }) }),
    }),
  }),
}));

describe("getNotifications", () => {
  it("maps rows and counts unread", async () => {
    const { getNotifications } = await import("./notifications-actions");
    const res = await getNotifications();
    expect(res.items).toHaveLength(2);
    expect(res.items[0].actorName).toBe("Jane");
    expect(res.unreadCount).toBe(1); // only n1 has read_at null
  });
});

describe("markNotificationsRead", () => {
  it("issues an update without throwing", async () => {
    const { markNotificationsRead } = await import("./notifications-actions");
    await expect(markNotificationsRead()).resolves.toBeUndefined();
    expect(updateEq2).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/app/notifications-actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the actions**

Create `app/app/notifications-actions.ts`:

```ts
"use server";

import { createServerSupabase } from "@/lib/supabase/server";

export type NotificationItem = {
  id: string;
  type: string;
  body: string;
  mockupId: string | null;
  readAt: string | null;
  createdAt: string;
  actorName: string;
};

export async function getNotifications(): Promise<{
  items: NotificationItem[];
  unreadCount: number;
}> {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { items: [], unreadCount: 0 };

  const { data } = await supabase
    .from("notifications")
    .select("id, type, body, mockup_id, read_at, created_at, actor:actor_id(name)")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const items: NotificationItem[] = (data ?? []).map((n) => ({
    id: n.id as string,
    type: n.type as string,
    body: n.body as string,
    mockupId: (n.mockup_id as string) ?? null,
    readAt: (n.read_at as string) ?? null,
    createdAt: n.created_at as string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actorName: ((n as any).actor?.name as string) || "Someone",
  }));
  const unreadCount = items.filter((i) => !i.readAt).length;
  return { items, unreadCount };
}

export async function markNotificationsRead(): Promise<void> {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userData.user.id)
    .is("read_at", null);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/app/notifications-actions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: tsc + full suite + commit**

Run: `npx tsc --noEmit -p . && npx vitest run`

```bash
git add app/app/notifications-actions.ts app/app/notifications-actions.test.ts
git commit -m "feat(notifications): getNotifications + markNotificationsRead actions"
```

---

### Task 5: NotificationBell component

**Files:**
- Create: `components/app/NotificationBell.tsx`
- Create: `components/app/NotificationBell.test.tsx`

**Interfaces:**
- Consumes: `getNotifications`, `markNotificationsRead` from `@/app/app/notifications-actions`; `timeAgo` from `@/lib/format`.
- Produces: `NotificationBell` client component (no props; fetches its own data).

- [ ] **Step 1: Write the failing test**

Create `components/app/NotificationBell.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const getNotifications = vi.fn().mockResolvedValue({
  items: [
    { id: "n1", type: "comment", body: "Jane commented on Home", mockupId: "m1", readAt: null, createdAt: new Date().toISOString(), actorName: "Jane" },
  ],
  unreadCount: 1,
});
const markNotificationsRead = vi.fn().mockResolvedValue(undefined);
vi.mock("@/app/app/notifications-actions", () => ({ getNotifications, markNotificationsRead }));

import { NotificationBell } from "./NotificationBell";

describe("NotificationBell", () => {
  it("shows an unread badge and the notification on open", async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText("1")).toBeTruthy()); // unread badge
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText(/Jane commented on Home/)).toBeTruthy();
    await waitFor(() => expect(markNotificationsRead).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/app/NotificationBell.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `components/app/NotificationBell.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getNotifications, markNotificationsRead, type NotificationItem } from "@/app/app/notifications-actions";
import { timeAgo } from "@/lib/format";

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await getNotifications();
    setItems(res.items);
    setUnread(res.unreadCount);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      await markNotificationsRead();
      setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={toggle}
        className="relative grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-[color:var(--accent)] hover:text-ink"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.625rem] font-bold text-white"
            style={{ background: "var(--color-danger)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border bg-surface-2 shadow-lg">
            <div className="border-b px-3 py-2.5 text-sm font-semibold text-ink">Notifications</div>
            <div className="max-h-96 divide-y overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-faint">You're all caught up.</p>
              ) : (
                items.map((n) => {
                  const inner = (
                    <div className="flex flex-col gap-0.5 px-3 py-2.5 transition-colors hover:bg-[color:var(--accent)]">
                      <span className="text-sm text-ink">{n.body}</span>
                      <span className="font-mono text-[0.6875rem] text-faint">{timeAgo(n.createdAt)}</span>
                    </div>
                  );
                  return n.mockupId ? (
                    <Link key={n.id} href={`/app/mockups/${n.mockupId}`} onClick={() => setOpen(false)} className="block">
                      {inner}
                    </Link>
                  ) : (
                    <div key={n.id}>{inner}</div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/app/NotificationBell.test.tsx`
Expected: PASS.

- [ ] **Step 5: tsc + full suite + commit**

Run: `npx tsc --noEmit -p . && npx vitest run`

```bash
git add components/app/NotificationBell.tsx components/app/NotificationBell.test.tsx
git commit -m "feat(notifications): NotificationBell with unread badge + polling"
```

---

### Task 6: Wire NotificationBell into the headers

**Files:**
- Modify: `app/app/page.tsx` (dashboard header, left of `ProfileMenu`)
- Modify: `app/app/mockups/[mockupId]/page.tsx` (viewer header, left of `ProfileMenu`)

**Interfaces:**
- Consumes: `NotificationBell` (Task 5).

- [ ] **Step 1: Add the bell to the dashboard header**

In `app/app/page.tsx`, add the import:
```tsx
import { NotificationBell } from "@/components/app/NotificationBell";
```
In the header's right cluster (where `ProfileMenu` was added in Phase 1), wrap the two so the bell sits to the left of the avatar:
```tsx
        <div className="ml-auto flex items-center gap-2 self-center">
          <NotificationBell />
          <ProfileMenu name={userName} email={userEmail} />
        </div>
```
(Replace the Phase-1 `<div className="ml-auto self-center"><ProfileMenu .../></div>` block.)

- [ ] **Step 2: Add the bell to the viewer header**

In `app/app/mockups/[mockupId]/page.tsx`, add the import:
```tsx
import { NotificationBell } from "@/components/app/NotificationBell";
```
In the header's right `<div className="flex items-center gap-3">`, add `<NotificationBell />` immediately before `<ProfileMenu ... />`.

- [ ] **Step 3: Verify build + tsc + full suite**

Run: `npm run build && npx tsc --noEmit -p . && npx vitest run`
Expected: build succeeds; tsc clean; all pass.

- [ ] **Step 4: Commit**

```bash
git add app/app/page.tsx app/app/mockups/[mockupId]/page.tsx
git commit -m "feat(notifications): NotificationBell in dashboard and viewer headers"
```

---

## Self-Review

**Spec coverage (Phase 2):**
- Notifications table + guarded creator + RLS → Task 1. ✅
- Notify on comment → Task 2. ✅
- Notify on invite/share (existing users) → Task 3. ✅
- getNotifications / markNotificationsRead → Task 4. ✅
- Bell UI (badge, list, poll, mark-read) → Task 5. ✅
- Wired into headers → Task 6. ✅
- Reuse email hooks (same write-sites) → Tasks 2–3. ✅

**Placeholder scan:** No TBD/TODO; every code step is complete. ✅

**Type consistency:** `create_notification` params (`p_user_id, p_actor_id, p_type, p_mockup_id, p_project_id, p_body`) are identical in the migration (Task 1) and every RPC call (Tasks 2–3). `NotificationItem` shape is identical across the action (Task 4), its test, the bell (Task 5), and its test. `getNotifications`/`markNotificationsRead` signatures match their consumers. ✅

**Migration-apply note:** `0007_notifications.sql` is applied to the cloud DB at deploy (`node scripts/db-apply.mjs ...`); the app's notification reads/writes only function once applied. Unit tests mock Supabase and pass regardless. The `create_notification` guard is the security boundary — verify it at deploy by confirming a cross-workspace user cannot create a notification (manual or a `scripts/notifications-check.mjs` mirroring `scripts/rls-check.mjs`). ✅
