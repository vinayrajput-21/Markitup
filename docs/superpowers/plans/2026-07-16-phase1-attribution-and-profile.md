# Phase 1 — Comment Attribution + Profile Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real comment author names + exact timestamps (never "You"/"Someone"), and add a profile avatar menu with a "Your Profile" page to edit your display name.

**Architecture:** Two independent slices. (A) Thread the current user's name from the mockup page into the viewer so optimistic comments show the real name; broaden the author fallback to use the email local-part; add an exact-time tooltip. (B) A reusable `ProfileMenu` client component (avatar → dropdown) rendered in the dashboard and viewer headers, plus an `/app/profile` page backed by an `updateProfileName` server action that syncs `profiles.name` and auth metadata.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Supabase (`@supabase/ssr`), Vitest + Testing Library.

## Global Constraints

- Server Actions live in `"use server"` files and return `{ error }` on failure / a typed payload on success; authenticate via the session, authorize via RLS.
- Reuse existing primitives: `Avatar` and `initials` from `components/app/AppSidebar.tsx`; `signOut` from `app/auth/actions.ts`; theme CSS vars (`--color-*`), `btn-*` and `field` classes; the outside-click dropdown pattern used in `MockupViewer.tsx` (a fixed full-screen click-catcher `<div>` behind an absolutely-positioned menu).
- No schema change in Phase 1 (`profiles.name`, `profiles.email` already exist).
- Existing tests stay green: run `npx vitest run` before each commit. `npm run build` before the final task's commit.
- Author display name is computed as `name || emailLocalPart(email) || "Unknown"` — never the literal "Someone".

---

### Task 1: Date/time + email-name format helpers

**Files:**
- Modify: `lib/format.ts`
- Modify: `lib/format.test.ts` (create if it does not exist)

**Interfaces:**
- Produces:
  - `formatDateTime(iso: string): string` — absolute local date+time, e.g. `"Jul 16, 2026, 3:42 PM"`.
  - `emailLocalPart(email: string): string` — the part before `@`, or `""` if none.

- [ ] **Step 1: Write the failing test**

Create/append `lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatDateTime, emailLocalPart } from "./format";

describe("formatDateTime", () => {
  it("renders an absolute date and time", () => {
    const out = formatDateTime("2026-07-16T15:42:00.000Z");
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/Jul|July/);
    // contains a time component
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("emailLocalPart", () => {
  it("returns the part before @", () => {
    expect(emailLocalPart("jane.doe@agency.com")).toBe("jane.doe");
  });
  it("returns empty string when there is no @", () => {
    expect(emailLocalPart("nope")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/format.test.ts`
Expected: FAIL — `formatDateTime`/`emailLocalPart` are not exported.

- [ ] **Step 3: Implement the helpers**

Append to `lib/format.ts`:

```ts
// Absolute local date + time, e.g. "Jul 16, 2026, 3:42 PM".
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The local-part of an email address ("jane@x.com" -> "jane"), or "" if absent.
export function emailLocalPart(email: string): string {
  const at = (email ?? "").indexOf("@");
  return at > 0 ? email.slice(0, at) : "";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/format.ts lib/format.test.ts
git commit -m "feat(format): add formatDateTime and emailLocalPart helpers"
```

---

### Task 2: Real author name + exact timestamp in the viewer

**Files:**
- Modify: `app/app/mockups/[mockupId]/page.tsx` (author fallback + pass current user name)
- Modify: `components/viewer/MockupViewer.tsx` (accept `currentUserName`, use it in the pin-composer optimistic comment, pass to `CommentThread`)
- Modify: `components/viewer/CommentThread.tsx` (accept `currentUserName`, use in optimistic `post()`, add exact-time tooltip)
- Modify: `components/viewer/MockupViewer.test.tsx` (pass the new prop; add attribution assertion)

**Interfaces:**
- Consumes: `emailLocalPart`, `formatDateTime` from `@/lib/format` (Task 1).
- Produces: `MockupViewer` gains prop `currentUserName: string`; `CommentThread` gains prop `currentUserName: string`.

- [ ] **Step 1: Write the failing test (attribution uses the real name)**

In `components/viewer/MockupViewer.test.tsx`, add a test that a posted pin-comment shows the current user's name, not "You". Append inside the existing `describe`:

```tsx
it("labels a newly created pin comment with the current user's name", async () => {
  const { MockupViewer } = await import("./MockupViewer");
  const { render, screen, fireEvent, waitFor } = await import("@testing-library/react");
  render(
    <MockupViewer
      mockupId="m1"
      imageUrl="http://x/y.png"
      imageName="y.png"
      initialPins={[]}
      siblings={[{ id: "m1" }]}
      members={[]}
      currentUserName="Ravi Rajput"
    />,
  );
  const img = screen.getByAltText("mockup");
  fireEvent.load(img);
  fireEvent.click(img);
  fireEvent.change(screen.getByPlaceholderText(/add comment here/i), {
    target: { value: "Fix the header" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^comment$/i }));
  await waitFor(() => expect(screen.getByText("Ravi Rajput")).toBeTruthy());
});
```

> If the test file already imports `render`/`screen`/`fireEvent`/`waitFor` at the top, reuse those and drop the inline `await import`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/viewer/MockupViewer.test.tsx`
Expected: FAIL — either the prop is unknown/unused and the comment still renders "You", so `getByText("Ravi Rajput")` is not found.

- [ ] **Step 3: Broaden the author fallback and pass the current user name in `page.tsx`**

In `app/app/mockups/[mockupId]/page.tsx`:

(a) Add the import:
```tsx
import { emailLocalPart } from "@/lib/format";
```

(b) Broaden the comments select to include the author email. Change the pins query's nested select from `comments(id, body, parent_comment_id, created_at, profiles(name))` to `comments(id, body, parent_comment_id, created_at, profiles(name, email))`.

(c) Change the comment mapping's author line from:
```tsx
      authorName: c.profiles?.name ?? "Someone",
```
to:
```tsx
      authorName: c.profiles?.name || emailLocalPart(c.profiles?.email ?? "") || "Unknown",
```

(d) Get the current user's display name and pass it to the viewer. Just before building `viewerPins` (after `supabase` is created), the page already calls Supabase; add:
```tsx
  const { data: authData } = await supabase.auth.getUser();
  const currentUserName =
    (authData.user?.user_metadata?.name as string) ||
    emailLocalPart(authData.user?.email ?? "") ||
    "You";
```
Then add the prop to the `<MockupViewer ... />` usage:
```tsx
            currentUserName={currentUserName}
```

- [ ] **Step 4: Thread `currentUserName` through `MockupViewer`**

In `components/viewer/MockupViewer.tsx`:

(a) Add `currentUserName` to the component's props type and destructure it:
```tsx
export function MockupViewer({
  mockupId,
  imageUrl,
  imageName,
  initialPins,
  siblings,
  members,
  currentUserName,
}: {
  mockupId: string;
  imageUrl: string;
  imageName: string;
  initialPins: ViewerPin[];
  siblings: Sibling[];
  members: Member[];
  currentUserName: string;
}) {
```

(b) In `saveDraft`, change the optimistic comment's `authorName` from `"You"` to `currentUserName`:
```tsx
          { id: `tmp-${pinId}`, body, authorName: currentUserName, parentCommentId: null, createdAt: new Date().toISOString() },
```

(c) Pass it to `CommentThread` (in the `activePin` branch of the aside):
```tsx
          <CommentThread
            mockupId={mockupId}
            pin={activePin}
            members={members}
            currentUserName={currentUserName}
            onBack={() => setActivePinId(null)}
            onChange={(updated) => setPins((ps) => ps.map((p) => (p.id === updated.id ? updated : p)))}
          />
```

- [ ] **Step 5: Use the name + exact-time tooltip in `CommentThread`**

In `components/viewer/CommentThread.tsx`:

(a) Add the import:
```tsx
import { timeAgo, formatDateTime } from "@/lib/format";
```
(replace the existing `import { timeAgo } from "@/lib/format";`).

(b) Add `currentUserName` to the props type and destructure it:
```tsx
export function CommentThread({
  mockupId,
  pin,
  members,
  currentUserName,
  onChange,
  onBack,
}: {
  mockupId: string;
  pin: ViewerPin;
  members: Member[];
  currentUserName: string;
  onChange: (p: ViewerPin) => void;
  onBack?: () => void;
}) {
```

(c) In `post()`, change the optimistic comment's `authorName` from `"You"` to `currentUserName`:
```tsx
      authorName: currentUserName,
```

(d) In `CommentRow`, add the exact-time tooltip to the relative-time span:
```tsx
          <span className="shrink-0 font-mono text-[0.6875rem] text-faint" title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</span>
```

- [ ] **Step 6: Run the viewer test to verify it passes**

Run: `npx vitest run components/viewer/MockupViewer.test.tsx`
Expected: PASS (the posted comment now shows "Ravi Rajput").

- [ ] **Step 7: Run the full suite**

Run: `npx vitest run`
Expected: all pass. If `CommentThread.test.tsx` renders `CommentThread` directly, it now needs a `currentUserName` prop — if that test fails for a missing prop, add `currentUserName="Tester"` to its render call (and only that).

- [ ] **Step 8: Commit**

```bash
git add app/app/mockups/[mockupId]/page.tsx components/viewer/MockupViewer.tsx components/viewer/CommentThread.tsx components/viewer/MockupViewer.test.tsx
git commit -m "feat(comments): show real author name + exact-time tooltip; drop 'Someone'/'You'"
```

---

### Task 3: ProfileMenu component

**Files:**
- Create: `components/app/ProfileMenu.tsx`
- Create: `components/app/ProfileMenu.test.tsx`

**Interfaces:**
- Consumes: `Avatar` from `@/components/app/AppSidebar`; `signOut` from `@/app/auth/actions`.
- Produces: `ProfileMenu` client component with props `{ name: string; email: string }`.

- [ ] **Step 1: Write the failing test**

Create `components/app/ProfileMenu.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));

import { ProfileMenu } from "./ProfileMenu";

describe("ProfileMenu", () => {
  it("opens a menu with Your Profile and Sign out", () => {
    render(<ProfileMenu name="Ravi Rajput" email="ravi@x.com" />);
    // menu hidden initially
    expect(screen.queryByText("Sign out")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByText("Your Profile")).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/app/ProfileMenu.test.tsx`
Expected: FAIL — `Cannot find module './ProfileMenu'`.

- [ ] **Step 3: Implement `ProfileMenu`**

Create `components/app/ProfileMenu.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "./AppSidebar";
import { signOut } from "@/app/auth/actions";

export function ProfileMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full ring-2 ring-transparent transition hover:ring-[color:var(--color-border-strong)]"
      >
        <Avatar name={name} email={email} size={32} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border bg-surface-2 shadow-lg">
            <div className="border-b px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-ink">{name || "Your account"}</p>
              <p className="truncate text-xs text-faint">{email}</p>
            </div>
            <Link
              href="/app/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink transition-colors hover:bg-[color:var(--accent)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
                <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              Your Profile
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-[color:var(--accent)]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M15 12H4m0 0 4-4m-4 4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/app/ProfileMenu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/app/ProfileMenu.tsx components/app/ProfileMenu.test.tsx
git commit -m "feat(app): ProfileMenu avatar dropdown (Your Profile / Sign out)"
```

---

### Task 4: updateProfileName server action

**Files:**
- Modify: `app/app/actions.ts`
- Create: `app/app/profile-actions.test.ts`

**Interfaces:**
- Produces: `updateProfileName(formData: FormData): Promise<{ error?: string }>` in `app/app/actions.ts` — updates `profiles.name` for the current user and mirrors it into `auth.updateUser({ data: { name } })`.

- [ ] **Step 1: Write the failing test**

Create `app/app/profile-actions.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const updateEq = vi.fn().mockResolvedValue({ error: null });
const authUpdate = vi.fn().mockResolvedValue({ error: null });
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } } }),
      updateUser: authUpdate,
    },
    from: () => ({ update: () => ({ eq: updateEq }) }),
  }),
}));

describe("updateProfileName", () => {
  it("rejects an empty name", async () => {
    const { updateProfileName } = await import("./actions");
    const fd = new FormData();
    fd.set("name", "   ");
    const res = await updateProfileName(fd);
    expect(res.error).toBeTruthy();
  });

  it("updates profiles.name and auth metadata on a valid name", async () => {
    const { updateProfileName } = await import("./actions");
    const fd = new FormData();
    fd.set("name", "Ravi Rajput");
    const res = await updateProfileName(fd);
    expect(res.error).toBeUndefined();
    expect(updateEq).toHaveBeenCalled();
    expect(authUpdate).toHaveBeenCalledWith({ data: { name: "Ravi Rajput" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/app/profile-actions.test.ts`
Expected: FAIL — `updateProfileName` is not exported.

- [ ] **Step 3: Implement the action**

Append to `app/app/actions.ts`:

```ts
export async function updateProfileName(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name cannot be empty" };
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("profiles")
    .update({ name })
    .eq("id", userData.user.id);
  if (error) return { error: error.message };

  // Mirror into auth metadata so headers/menus that read user_metadata stay in sync.
  await supabase.auth.updateUser({ data: { name } });

  revalidatePath("/app");
  return {};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/app/profile-actions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run full suite and commit**

Run: `npx vitest run`
Expected: all pass.

```bash
git add app/app/actions.ts app/app/profile-actions.test.ts
git commit -m "feat(profile): updateProfileName action (syncs profiles.name + auth metadata)"
```

---

### Task 5: Profile page + wire ProfileMenu into headers

**Files:**
- Create: `app/app/profile/page.tsx`
- Modify: `app/app/page.tsx` (render `ProfileMenu` in the dashboard header)
- Modify: `app/app/mockups/[mockupId]/page.tsx` (render `ProfileMenu` in the viewer header)

**Interfaces:**
- Consumes: `ProfileMenu` (Task 3); `updateProfileName` (Task 4); `emailLocalPart` (Task 1).

- [ ] **Step 1: Build the profile page**

Create `app/app/profile/page.tsx`:

```tsx
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { updateProfileName } from "@/app/app/actions";
import { emailLocalPart } from "@/lib/format";

export default async function ProfilePage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? "";
  const name =
    (data.user?.user_metadata?.name as string) || emailLocalPart(email) || "";

  return (
    <div className="mx-auto max-w-lg px-8 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Your Profile</h1>
      <p className="mt-1 text-sm text-muted">Update how your name appears on comments and shares.</p>

      <form
        action={async (formData: FormData) => {
          "use server";
          await updateProfileName(formData);
        }}
        className="mt-8 flex flex-col gap-4"
      >
        <div>
          <label htmlFor="name" className="field-label">Display name</label>
          <input id="name" name="name" defaultValue={name} required className="field" />
        </div>
        <div>
          <label className="field-label">Email</label>
          <input value={email} disabled className="field opacity-70" />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">Save changes</button>
          <Link href="/forgot-password" className="text-sm font-semibold text-brand hover:text-brand-hover">
            Change password
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Render `ProfileMenu` in the dashboard header**

In `app/app/page.tsx`:

(a) Add imports:
```tsx
import { ProfileMenu } from "@/components/app/ProfileMenu";
import { emailLocalPart } from "@/lib/format";
```

(b) Inside `ProjectsPage`, after `const supabase = await createServerSupabase();`, read the user:
```tsx
  const { data: authData } = await supabase.auth.getUser();
  const userEmail = authData.user?.email ?? "";
  const userName = (authData.user?.user_metadata?.name as string) || emailLocalPart(userEmail) || "";
```

(c) In the header block, wrap the title and the create-project form so the ProfileMenu sits at the top-right. Replace the opening of the header `<div className="mb-8 flex flex-wrap items-end justify-between gap-4">` content so it ends with the ProfileMenu. Concretely, add — as the last child of that header `<div>`, after the `<form>...</form>` — :
```tsx
        <div className="ml-auto self-center">
          <ProfileMenu name={userName} email={userEmail} />
        </div>
```

- [ ] **Step 3: Render `ProfileMenu` in the viewer header**

In `app/app/mockups/[mockupId]/page.tsx`, the header's right cluster currently holds the resolved count and `<ShareDialog />`. Add the ProfileMenu next to it.

(a) Add the import:
```tsx
import { ProfileMenu } from "@/components/app/ProfileMenu";
```

(b) `currentUserName` and the user were already read in Task 2 (step 3d). Also capture the email there by extending that block:
```tsx
  const currentUserEmail = authData.user?.email ?? "";
```

(c) In the header's right-side `<div className="flex items-center gap-3">`, add the ProfileMenu as the last child (after `<ShareDialog ... />`):
```tsx
          <ProfileMenu name={currentUserName} email={currentUserEmail} />
```

- [ ] **Step 4: Verify build + full suite**

Run: `npm run build && npx vitest run`
Expected: build succeeds and lists the `/app/profile` route; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/app/profile/page.tsx app/app/page.tsx app/app/mockups/[mockupId]/page.tsx
git commit -m "feat(profile): profile page + ProfileMenu in dashboard and viewer headers"
```

---

## Self-Review

**Spec coverage (Phase 1 slice):**
- 1A real author name (drop "Someone"/"You") → Task 2. ✅
- 1A exact date/time → Task 1 (`formatDateTime`) + Task 2 (tooltip). ✅
- 1B profile avatar menu (Your Profile / Sign out) → Task 3 + Task 5 (wiring). ✅
- 1B "Your Profile" page to edit display name, email read-only, password→reset link → Task 5 + Task 4 (action). ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✅

**Type consistency:** `currentUserName: string` is introduced in Task 2 and threaded identically through `MockupViewer` and `CommentThread`; `ProfileMenu` props `{ name, email }` are used the same in Task 3, its test, and Task 5's two call sites; `updateProfileName(formData)` signature matches its test and the profile page's form action. `emailLocalPart`/`formatDateTime` from Task 1 are consumed in Tasks 2 and 5. ✅

**Ambiguity check:** Task 2 step 7 flags the one cross-file ripple (a direct `CommentThread` render test needing the new prop) and how to resolve it, rather than leaving it implicit. ✅
