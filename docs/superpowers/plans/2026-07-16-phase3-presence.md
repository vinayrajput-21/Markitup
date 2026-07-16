# Phase 3 — "Recently Viewed By" Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Record who opens each mockup and when, and show an avatar stack + "Recently viewed by" dropdown in the viewer header.

**Architecture:** A `mockup_views` table (one row per user per mockup, `viewed_at` upserted on open). A best-effort `recordMockupView` server action is called from a tiny client effect on the viewer. The mockup page fetches recent viewers server-side and renders a `RecentViewers` client dropdown in the header.

**Tech Stack:** Next.js 16 (Server Actions), React 19, Supabase (`@supabase/ssr`), Postgres RLS, Vitest + Testing Library.

## Global Constraints

- `recordMockupView` is best-effort: it never throws into the page and never blocks rendering (called from a client `useEffect`, not during SSR).
- `mockup_views` has RLS: you can SELECT rows for mockups you can see (reuse `can_see_pin(mockup_id)`, which checks the mockup's project visibility despite its name), and INSERT/UPDATE only your OWN row for a mockup you can see.
- Migration `0008_mockup_views.sql` is **applied to the cloud DB at deploy** (`node scripts/db-apply.mjs ...`), not during this build. Unit tests mock Supabase. Confirm 0008 is the next free number when building.
- Reuse existing primitives: `Avatar` from `components/app/AppSidebar`, `timeAgo` from `lib/format`, the outside-click dropdown pattern.
- Run `npx tsc --noEmit -p .` before each commit; `npm run build` on the wiring task. Existing 52 tests stay green.

---

### Task 1: Migration — mockup_views table + RLS

**Files:**
- Create: `supabase/migrations/0008_mockup_views.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0008_mockup_views.sql`:

```sql
create table public.mockup_views (
  mockup_id uuid not null references public.mockups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (mockup_id, user_id)
);
create index mockup_views_recent on public.mockup_views (mockup_id, viewed_at desc);

alter table public.mockup_views enable row level security;

-- You can see who viewed a mockup you can see; you can record/refresh only your
-- own view. can_see_pin(mockup_id) checks the mockup's project visibility.
create policy "see mockup views" on public.mockup_views
  for select using (public.can_see_pin(mockup_id));
create policy "record own view" on public.mockup_views
  for insert with check (user_id = auth.uid() and public.can_see_pin(mockup_id));
create policy "refresh own view" on public.mockup_views
  for update using (user_id = auth.uid() and public.can_see_pin(mockup_id));
```

- [ ] **Step 2: Sanity-check the SQL by eye** against `0004_pins_comments.sql` (same `can_see_pin` helper, same policy idiom). No DB apply here.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_mockup_views.sql
git commit -m "feat(db): mockup_views table + RLS (migration)"
```

---

### Task 2: recordMockupView action

**Files:**
- Create: `app/app/mockups/[mockupId]/view-actions.ts`
- Create: `app/app/mockups/view-actions.test.ts`

**Interfaces:**
- Produces: `recordMockupView(mockupId: string): Promise<void>` — upserts the current user's view row.

- [ ] **Step 1: Write the failing test**

Create `app/app/mockups/view-actions.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const upsert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({ upsert }),
  }),
}));

describe("recordMockupView", () => {
  it("upserts the current user's view for the mockup", async () => {
    const { recordMockupView } = await import("./[mockupId]/view-actions");
    await expect(recordMockupView("m1")).resolves.toBeUndefined();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ mockup_id: "m1", user_id: "u1" }),
      expect.objectContaining({ onConflict: "mockup_id,user_id" }),
    );
  });

  it("does nothing when signed out (no throw)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/server", () => ({
      createServerSupabase: async () => ({
        auth: { getUser: async () => ({ data: { user: null } }) },
        from: () => ({ upsert }),
      }),
    }));
    const { recordMockupView } = await import("./[mockupId]/view-actions");
    await expect(recordMockupView("m1")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/app/mockups/view-actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the action**

Create `app/app/mockups/[mockupId]/view-actions.ts`:

```ts
"use server";

import { createServerSupabase } from "@/lib/supabase/server";

// Best-effort: record (or refresh) that the current user viewed this mockup.
// Never throws into the caller.
export async function recordMockupView(mockupId: string): Promise<void> {
  try {
    const supabase = await createServerSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("mockup_views").upsert(
      { mockup_id: mockupId, user_id: userData.user.id, viewed_at: new Date().toISOString() },
      { onConflict: "mockup_id,user_id" },
    );
  } catch (e) {
    console.error("[view] record failed", e);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/app/mockups/view-actions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: tsc + full suite + commit**

Run: `npx tsc --noEmit -p . && npx vitest run`

```bash
git add app/app/mockups/[mockupId]/view-actions.ts app/app/mockups/view-actions.test.ts
git commit -m "feat(presence): recordMockupView upsert action"
```

---

### Task 3: RecentViewers component

**Files:**
- Create: `components/viewer/RecentViewers.tsx`
- Create: `components/viewer/RecentViewers.test.tsx`

**Interfaces:**
- Consumes: `Avatar` from `@/components/app/AppSidebar`; `timeAgo` from `@/lib/format`.
- Produces: `RecentViewers` client component with prop `viewers: Viewer[]` where `Viewer = { id: string; name: string; email: string; viewedAt: string }`.

- [ ] **Step 1: Write the failing test**

Create `components/viewer/RecentViewers.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/app/AppSidebar", () => ({
  Avatar: ({ name }: { name: string }) => <span>{name[0]}</span>,
}));

import { RecentViewers } from "./RecentViewers";

const viewers = [
  { id: "u1", name: "Ravi Rajput", email: "ravi@x.com", viewedAt: new Date().toISOString() },
  { id: "u2", name: "Dr Mira Saric", email: "mira@x.com", viewedAt: new Date(Date.now() - 3600_000).toISOString() },
];

describe("RecentViewers", () => {
  it("renders nothing when there are no viewers", () => {
    const { container } = render(<RecentViewers viewers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists viewers with names in the dropdown", () => {
    render(<RecentViewers viewers={viewers} />);
    fireEvent.click(screen.getByRole("button", { name: /viewed by/i }));
    expect(screen.getByText("Ravi Rajput")).toBeTruthy();
    expect(screen.getByText("Dr Mira Saric")).toBeTruthy();
    expect(screen.getByText(/Recently viewed by/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/viewer/RecentViewers.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `components/viewer/RecentViewers.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Avatar } from "@/components/app/AppSidebar";
import { timeAgo } from "@/lib/format";

export type Viewer = { id: string; name: string; email: string; viewedAt: string };

export function RecentViewers({ viewers }: { viewers: Viewer[] }) {
  const [open, setOpen] = useState(false);
  if (viewers.length === 0) return null;
  const shown = viewers.slice(0, 5);
  const extra = viewers.length - shown.length;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Viewed by ${viewers.length}`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center rounded-full pl-1 transition hover:opacity-90"
      >
        <span className="flex -space-x-2">
          {shown.map((v) => (
            <span key={v.id} className="rounded-full ring-2 ring-[color:var(--color-surface)]">
              <Avatar name={v.name} email={v.email} size={26} />
            </span>
          ))}
          {extra > 0 && (
            <span
              className="grid h-[26px] w-[26px] place-items-center rounded-full text-[0.625rem] font-semibold ring-2 ring-[color:var(--color-surface)]"
              style={{ background: "var(--color-brand-soft)", color: "var(--color-brand-ink)" }}
            >
              +{extra}
            </span>
          )}
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border bg-surface-2 shadow-lg">
            <div className="border-b px-3 py-2 text-xs font-semibold text-muted">Recently viewed by</div>
            <ul className="max-h-80 divide-y overflow-y-auto">
              {viewers.map((v) => (
                <li key={v.id} className="flex items-center gap-2.5 px-3 py-2">
                  <Avatar name={v.name} email={v.email} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{v.name}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[0.6875rem] text-faint">{timeAgo(v.viewedAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/viewer/RecentViewers.test.tsx`
Expected: PASS.

- [ ] **Step 5: tsc + full suite + commit**

Run: `npx tsc --noEmit -p . && npx vitest run`

```bash
git add components/viewer/RecentViewers.tsx components/viewer/RecentViewers.test.tsx
git commit -m "feat(presence): RecentViewers avatar stack + dropdown"
```

---

### Task 4: Wire presence into the viewer

**Files:**
- Create: `components/viewer/RecordView.tsx`
- Modify: `app/app/mockups/[mockupId]/page.tsx` (fetch viewers, render `RecentViewers` + `RecordView`)

**Interfaces:**
- Consumes: `recordMockupView` (Task 2), `RecentViewers` + `Viewer` (Task 3).
- Produces: `RecordView` client component with prop `{ mockupId: string }` (fires `recordMockupView` on mount, renders nothing).

- [ ] **Step 1: Create the record-on-mount client component**

Create `components/viewer/RecordView.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { recordMockupView } from "@/app/app/mockups/[mockupId]/view-actions";

export function RecordView({ mockupId }: { mockupId: string }) {
  useEffect(() => {
    recordMockupView(mockupId);
  }, [mockupId]);
  return null;
}
```

- [ ] **Step 2: Fetch viewers and render in the viewer header**

In `app/app/mockups/[mockupId]/page.tsx`:

(a) Add imports:
```tsx
import { RecentViewers, type Viewer } from "@/components/viewer/RecentViewers";
import { RecordView } from "@/components/viewer/RecordView";
```

(b) After the pins query (near the other queries), fetch recent viewers:
```tsx
  const { data: viewRows } = await supabase
    .from("mockup_views")
    .select("viewed_at, profiles:user_id(id, name, email)")
    .eq("mockup_id", mockupId)
    .order("viewed_at", { ascending: false })
    .limit(8);
  const viewers: Viewer[] = (viewRows ?? []).map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (r as any).profiles;
    return { id: p?.id ?? "", name: p?.name || "Someone", email: p?.email ?? "", viewedAt: r.viewed_at as string };
  }).filter((v) => v.id);
```

(c) In the header's right cluster `<div className="flex items-center gap-3">`, add `<RecentViewers viewers={viewers} />` as the FIRST child (before the resolved count / ShareDialog / bell / profile):
```tsx
          <RecentViewers viewers={viewers} />
```

(d) Render `RecordView` once inside the page (it renders nothing). Add it right after the opening `<div className="flex h-full flex-col">` of the returned JSX:
```tsx
      <RecordView mockupId={mockupId} />
```

- [ ] **Step 3: Verify build + tsc + full suite**

Run: `npm run build && npx tsc --noEmit -p . && npx vitest run`
Expected: build succeeds; tsc clean; all pass.

- [ ] **Step 4: Commit**

```bash
git add components/viewer/RecordView.tsx app/app/mockups/[mockupId]/page.tsx
git commit -m "feat(presence): record + show recent viewers in the mockup viewer"
```

---

## Self-Review

**Spec coverage (Phase 3):**
- `mockup_views` table + RLS → Task 1. ✅
- Record view on open (best-effort, client effect) → Task 2 (action) + Task 4 (`RecordView`). ✅
- Avatar stack + "Recently viewed by" dropdown in viewer header → Task 3 + Task 4. ✅

**Placeholder scan:** No TBD/TODO; complete code throughout. ✅

**Type consistency:** `Viewer` shape (`id, name, email, viewedAt`) is identical in the component (Task 3), its test, and the page mapping (Task 4). `recordMockupView(mockupId: string): Promise<void>` matches its test and `RecordView`. ✅

**Migration-apply note:** `0008_mockup_views.sql` applies at deploy; the viewer list/record only function once applied (unit tests mock Supabase). RLS reuses the already-proven `can_see_pin` helper. ✅

**Known minor:** the current user's own view is recorded on mount, so it appears in the list on the next load, not instantly (acceptable; matches "recorded on open" semantics).
