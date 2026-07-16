# Group A — Attribution Fix + Folder Removal + New Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix comment authors showing "Unknown" (an RLS gap), remove the folder concept from the dashboard (keeping counts + archive), and add a "New" badge to mockups the current user hasn't opened.

**Architecture:** A1 is a single RLS policy migration (no app code). A2 removes folder UI/actions/route, reducing the card menu to archive-only and showing all non-archived projects. A3 adds a per-user unviewed check on the project page using the existing `mockup_views` table.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase (`@supabase/ssr`), Postgres RLS, Vitest + Testing Library.

## Global Constraints

- **Disk workaround:** the `C:` drive is nearly full; before any `npm run build` / `npx` / vitest run, prefix `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build` in the same command, and prefer `node_modules/.bin/tsc` / `node_modules/.bin/vitest run` if npx misbehaves. `/d/tmp/claude-build` exists.
- Run `npx tsc --noEmit -p .` before each commit; `npm run build` on tasks that change routes/pages. Existing 65 tests stay green (some will be removed/updated in A2 — that's expected).
- Migration `0010` applies to the cloud DB at deploy. Confirm it's the next free number.
- Keep the `projects.folder_id`/`archived_at` columns (unused after folder removal). Do NOT write a migration to drop them.

---

### Task 1: Migration — read co-project-member profiles

**Files:**
- Create: `supabase/migrations/0010_project_member_profiles.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0010_project_member_profiles.sql`:

```sql
-- Let you read the profile of anyone who shares a PROJECT with you (not just a
-- workspace). Fixes comment authors showing "Unknown" and missing @mentions for
-- clients invited to a single project. can_see_project is SECURITY DEFINER, so
-- this does not recurse into profiles' own RLS.
create policy "read co-project-member profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.project_members pm
      where pm.user_id = profiles.id and public.can_see_project(pm.project_id)
    )
  );
```

- [ ] **Step 2: Sanity-check by eye** against `0001_profiles_workspaces.sql`'s existing `read co-member profiles` policy and `0002`'s `can_see_project`. No DB apply here.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0010_project_member_profiles.sql
git commit -m "fix(db): read co-project-member profiles so client names resolve (migration)"
```

---

### Task 2: Remove the folder concept

**Files:**
- Modify: `app/app/page.tsx` (drop folders; show all non-archived projects)
- Modify: `components/app/ProjectCardMenu.tsx` (archive-only)
- Modify: `components/app/ProjectCardMenu.test.tsx` (archive-only)
- Modify: `app/app/folders-actions.ts` (remove folder actions; keep archive)
- Modify: `app/app/folders-actions.test.ts` (remove folder-action tests)
- Delete: `app/app/folders/[folderId]/page.tsx`
- Delete: `components/app/NewFolderButton.tsx`
- Delete: `components/app/NewFolderButton.test.tsx`

**Interfaces:**
- `ProjectCardMenu` new props: `{ projectId: string }` (folders/currentFolderId removed).

- [ ] **Step 1: Reduce `ProjectCardMenu` to archive-only**

Replace `components/app/ProjectCardMenu.tsx` with:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveProject } from "@/app/app/folders-actions";

export function ProjectCardMenu({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<unknown>) {
    setOpen(false);
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Project options"
        disabled={pending}
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-[color:var(--accent)] hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="5" cy="12" r="1.6" fill="currentColor" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          <circle cx="19" cy="12" r="1.6" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.preventDefault(); setOpen(false); }} />
          <div className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-lg border bg-surface-2 p-1 shadow-lg">
            <button onClick={() => run(() => archiveProject(projectId))} className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-[color:var(--accent)]" style={{ color: "var(--color-danger)" }}>
              Archive project
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update the ProjectCardMenu test to archive-only**

Replace `components/app/ProjectCardMenu.test.tsx` with:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const archiveProject = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("@/app/app/folders-actions", () => ({ archiveProject }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { ProjectCardMenu } from "./ProjectCardMenu";

describe("ProjectCardMenu", () => {
  it("archives via the menu", async () => {
    render(<ProjectCardMenu projectId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: /project options/i }));
    fireEvent.click(screen.getByText(/archive/i));
    await waitFor(() => expect(archiveProject).toHaveBeenCalledWith("p1"));
  });
});
```

- [ ] **Step 3: Remove folder actions, keep archive**

In `app/app/folders-actions.ts`, delete the exported functions `createFolder`, `renameFolder`, `deleteFolder`, and `moveProjectToFolder`. Keep `archiveProject` and `unarchiveProject` exactly as they are. Remove the now-unused `getCurrentWorkspace` import if nothing else in the file uses it (archive/unarchive don't). The file should end up importing only `revalidatePath` and `createServerSupabase` and exporting the two archive actions.

- [ ] **Step 4: Update folders-actions test**

Replace `app/app/folders-actions.test.ts` with a version that only tests archive/unarchive:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const updateEq = vi.fn().mockResolvedValue({ error: null });
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    from: () => ({ update: () => ({ eq: updateEq }) }),
  }),
}));

beforeEach(() => updateEq.mockClear());

describe("archive actions", () => {
  it("archiveProject sets archived_at; unarchive clears it", async () => {
    const { archiveProject, unarchiveProject } = await import("./folders-actions");
    expect((await archiveProject("p1")).error).toBeUndefined();
    expect((await unarchiveProject("p1")).error).toBeUndefined();
    expect(updateEq).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 5: Delete the folder route + NewFolderButton**

```bash
git rm "app/app/folders/[folderId]/page.tsx" components/app/NewFolderButton.tsx components/app/NewFolderButton.test.tsx
```

- [ ] **Step 6: Rewrite the dashboard without folders**

Replace `app/app/page.tsx` with (drops folders query/section + NewFolderButton; shows ALL non-archived projects; keeps counts, New project, Invite, bell, profile):

```tsx
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace, createProject } from "./actions";
import { getWorkspaceStats, signCovers, type ProjectStats } from "./dashboard-data";
import { plural, emailLocalPart } from "@/lib/format";
import { ProjectCard } from "@/components/app/ProjectCard";
import { ProjectCardMenu } from "@/components/app/ProjectCardMenu";
import { NotificationBell } from "@/components/app/NotificationBell";
import { ProfileMenu } from "@/components/app/ProfileMenu";

type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  archived_at: string | null;
  mockups: { id: string; file_path: string; created_at: string }[];
};

export default async function DashboardPage() {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const userEmail = authData.user?.email ?? "";
  const userName = (authData.user?.user_metadata?.name as string) || emailLocalPart(userEmail) || "";

  const { data: projectData } = await supabase
    .from("projects")
    .select("id, name, created_at, archived_at, mockups(id, file_path, created_at)")
    .eq("workspace_id", ws?.id ?? "")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const projects = (projectData ?? []) as ProjectRow[];
  const stats = await getWorkspaceStats(supabase, projects.map((p) => p.id));
  const covers = await signCovers(
    supabase,
    projects.map((p) => [...p.mockups].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.file_path).filter(Boolean) as string[],
  );
  function coverFor(p: ProjectRow) {
    const latest = [...p.mockups].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return latest ? covers.get(latest.file_path) : undefined;
  }
  const zero: ProjectStats = { mockups: 0, comments: 0, resolved: 0 };

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">{ws?.name} · {plural(projects.length, "project")}</p>
        </div>
        <div className="flex items-center gap-2">
          <form action={async (formData: FormData) => { "use server"; await createProject(formData); }} className="flex items-center gap-2">
            <input name="name" placeholder="New project…" required className="field h-10 w-44" />
            <button className="btn-primary btn-sm">New project</button>
          </form>
          <Link href="/app/members" className="btn-secondary btn-sm">Invite</Link>
          <NotificationBell />
          <ProfileMenu name={userName} email={userEmail} />
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No projects yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted">Create a project above, upload a mockup, and start collecting pinned feedback.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <ProjectCard
                id={p.id}
                name={p.name}
                coverUrl={coverFor(p)}
                updatedAt={p.created_at}
                stats={stats.get(p.id) ?? zero}
                menu={<ProjectCardMenu projectId={p.id} />}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verify build + tsc + full suite**

Run: `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build; npm run build && node_modules/.bin/tsc --noEmit -p . && node_modules/.bin/vitest run`
Expected: build succeeds; `/app/folders/[folderId]` no longer listed; tsc clean; all remaining tests pass (folder-action + NewFolderButton tests are gone).

- [ ] **Step 8: Commit**

```bash
git add app/app/page.tsx components/app/ProjectCardMenu.tsx components/app/ProjectCardMenu.test.tsx app/app/folders-actions.ts app/app/folders-actions.test.ts
git commit -m "feat(dashboard): remove folders; keep project counts + archive"
```

---

### Task 3: "New" badge on unviewed mockups

**Files:**
- Modify: `app/app/projects/[projectId]/page.tsx`

- [ ] **Step 1: Fetch the current user's viewed mockups and badge the rest**

In `app/app/projects/[projectId]/page.tsx`:

(a) After the `mockups` query and before rendering, read the current user and their views for these mockups:
```tsx
  const { data: authData } = await supabase.auth.getUser();
  const meId = authData.user?.id ?? "";
  const ids = rows.map((m) => m.id);
  const viewedIds = new Set<string>();
  if (meId && ids.length) {
    const { data: views } = await supabase
      .from("mockup_views")
      .select("mockup_id")
      .eq("user_id", meId)
      .in("mockup_id", ids);
    for (const v of views ?? []) viewedIds.add(v.mockup_id as string);
  }
```

(b) In the mockup card's thumbnail wrapper (the `<div className="aspect-[4/3] ...">`), add a "New" badge for unviewed mockups. Change that wrapper to be `relative` and add the badge as its first child:
```tsx
                <div className="relative aspect-[4/3] w-full overflow-hidden border-b bg-canvas">
                  {!viewedIds.has(m.id) && (
                    <span
                      className="absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white"
                      style={{ background: "var(--color-brand)" }}
                    >
                      New
                    </span>
                  )}
                  {signed.get(m.file_path) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={signed.get(m.file_path)} alt="" className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className="h-full w-full bg-brand-soft" />
                  )}
                </div>
```

- [ ] **Step 2: Verify build + tsc + full suite**

Run: `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build; npm run build && node_modules/.bin/tsc --noEmit -p . && node_modules/.bin/vitest run`
Expected: build succeeds; tsc clean; all pass.

- [ ] **Step 3: Commit**

```bash
git add app/app/projects/[projectId]/page.tsx
git commit -m "feat(projects): show a New badge on mockups you haven't opened"
```

---

## Self-Review

**Spec coverage (Group A):**
- A1 co-project-member profile read → Task 1. ✅
- A2 remove folders, keep counts + archive → Task 2 (dashboard rewrite, archive-only menu, folder route/NewFolderButton deleted, folder actions removed, archive kept). ✅
- A3 New badge on unviewed mockups → Task 3. ✅

**Placeholder scan:** No TBD/TODO; complete code throughout. ✅

**Type consistency:** `ProjectCardMenu` reduced to `{ projectId: string }` in the component, its test, and the dashboard call site (Task 2). `archiveProject`/`unarchiveProject` signatures unchanged. `ProjectStats`/`ProjectCard` props unchanged from Phase 4. ✅

**Removal safety:** deleting the folder route + NewFolderButton + folder actions is self-consistent — the dashboard no longer references them, `ProjectCardMenu` no longer imports move-to-folder, and the folder-action tests are removed. `getWorkspaceStats`/`signCovers`/`ProjectCard` (Phase 4, kept) are still used. The `projects.folder_id` column remains but is simply unread. ✅

**Migration-apply note:** `0010` applies at deploy; the "Unknown" fix only takes effect once applied (unit tests mock Supabase). It reuses the proven `can_see_project`. ✅
