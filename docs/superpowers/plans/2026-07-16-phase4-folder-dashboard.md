# Phase 4 — Folder Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Group projects into folders, show project cards with counts (mockups / comments / resolved), and add archive — a markup.io-style dashboard. NO live-URL website markups (out of scope).

**Architecture:** A `folders` table (workspace-scoped) plus `folder_id` and `archived_at` columns on `projects`. Server actions manage folders, move, and archive. The dashboard shows folder cards + top-level (folder-less, non-archived) project cards; a folder route shows its projects; an archive route lists archived projects. Card counts come from a SECURITY DEFINER `project_stats` function. Client sub-components handle the new-folder form, the per-card move/archive menu, and client-side filter/sort/search.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Supabase (`@supabase/ssr`), Postgres RLS, Vitest + Testing Library.

## Global Constraints

- Folder actions authenticate via session and authorize via RLS (`is_workspace_member`); return `{ error }` / `{}`.
- `folders` RLS: select/insert/update/delete gated on `is_workspace_member(workspace_id)`. Deleting a folder sets its projects' `folder_id` to null (`on delete set null`) — never deletes projects.
- `project_stats(p uuid)` is SECURITY DEFINER and returns zero-row (→ treated as zeros) unless `can_see_project(p)`.
- The dashboard must PRESERVE the Phase 1/2 header additions (`NotificationBell`, `ProfileMenu`) and the existing create-project flow and cover-thumbnail signing.
- Migration `0009_folders.sql` applies to the cloud DB at deploy (`node scripts/db-apply.mjs ...`), not during this build. Confirm 0009 is the next free number when building.
- Run `npx tsc --noEmit -p .` before each commit; `npm run build` on tasks that add routes/JSX. Existing 56 tests stay green.

---

### Task 1: Migration — folders, folder_id, archived_at, project_stats

**Files:**
- Create: `supabase/migrations/0009_folders.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0009_folders.sql`:

```sql
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.projects add column folder_id uuid references public.folders(id) on delete set null;
alter table public.projects add column archived_at timestamptz;

alter table public.folders enable row level security;

create policy "see folders" on public.folders
  for select using (public.is_workspace_member(workspace_id));
create policy "members create folders" on public.folders
  for insert with check (public.is_workspace_member(workspace_id));
create policy "members update folders" on public.folders
  for update using (public.is_workspace_member(workspace_id));
create policy "members delete folders" on public.folders
  for delete using (public.is_workspace_member(workspace_id));

-- Card counts for a project, RLS-respecting: returns no row unless the caller
-- can see the project (callers then treat missing as zeros).
create function public.project_stats(p uuid)
returns table (mockups int, comments int, resolved int)
language sql security definer stable set search_path = public as $$
  select
    (select count(*) from public.mockups m where m.project_id = p)::int,
    (select count(*) from public.comments c
       join public.pins pn on pn.id = c.pin_id
       join public.mockups m on m.id = pn.mockup_id
       where m.project_id = p)::int,
    (select count(*) from public.pins pn
       join public.mockups m on m.id = pn.mockup_id
       where m.project_id = p and pn.status = 'resolved')::int
  where public.can_see_project(p);
$$;

grant execute on function public.project_stats(uuid) to authenticated;
```

- [ ] **Step 2: Sanity-check by eye** against `0002_projects_members.sql` (same `is_workspace_member` policy idiom) and `0002`'s `can_see_project`. No DB apply here.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0009_folders.sql
git commit -m "feat(db): folders table + projects.folder_id/archived_at + project_stats (migration)"
```

---

### Task 2: Folder + archive server actions

**Files:**
- Create: `app/app/folders-actions.ts`
- Create: `app/app/folders-actions.test.ts`

**Interfaces:**
- Produces (all in `folders-actions.ts`):
  - `createFolder(formData: FormData): Promise<{ error?: string }>` (reads `name`)
  - `renameFolder(id: string, name: string): Promise<{ error?: string }>`
  - `deleteFolder(id: string): Promise<{ error?: string }>`
  - `moveProjectToFolder(projectId: string, folderId: string | null): Promise<{ error?: string }>`
  - `archiveProject(projectId: string): Promise<{ error?: string }>`
  - `unarchiveProject(projectId: string): Promise<{ error?: string }>`

- [ ] **Step 1: Write the failing test**

Create `app/app/folders-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn().mockResolvedValue({ error: null });
const updateEq = vi.fn().mockResolvedValue({ error: null });
const deleteEq = vi.fn().mockResolvedValue({ error: null });
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("./actions", () => ({ getCurrentWorkspace: async () => ({ id: "ws1", name: "W" }) }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({
      insert,
      update: () => ({ eq: updateEq }),
      delete: () => ({ eq: deleteEq }),
    }),
  }),
}));

beforeEach(() => { insert.mockClear(); updateEq.mockClear(); deleteEq.mockClear(); });

describe("folders-actions", () => {
  it("createFolder rejects an empty name", async () => {
    const { createFolder } = await import("./folders-actions");
    const fd = new FormData();
    fd.set("name", "  ");
    expect((await createFolder(fd)).error).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });

  it("createFolder inserts with the workspace + user", async () => {
    const { createFolder } = await import("./folders-actions");
    const fd = new FormData();
    fd.set("name", "Client work");
    expect((await createFolder(fd)).error).toBeUndefined();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Client work", workspace_id: "ws1", created_by: "u1" }),
    );
  });

  it("moveProjectToFolder updates the project's folder_id", async () => {
    const { moveProjectToFolder } = await import("./folders-actions");
    expect((await moveProjectToFolder("p1", "f1")).error).toBeUndefined();
    expect(updateEq).toHaveBeenCalled();
  });

  it("archiveProject sets archived_at; unarchive clears it", async () => {
    const { archiveProject, unarchiveProject } = await import("./folders-actions");
    expect((await archiveProject("p1")).error).toBeUndefined();
    expect((await unarchiveProject("p1")).error).toBeUndefined();
    expect(updateEq).toHaveBeenCalledTimes(2);
  });

  it("deleteFolder deletes by id", async () => {
    const { deleteFolder } = await import("./folders-actions");
    expect((await deleteFolder("f1")).error).toBeUndefined();
    expect(deleteEq).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/app/folders-actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the actions**

Create `app/app/folders-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "./actions";

export async function createFolder(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Folder name is required" };
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("folders")
    .insert({ name, workspace_id: ws.id, created_by: userData.user!.id });
  if (error) return { error: error.message };
  revalidatePath("/app");
  return {};
}

export async function renameFolder(id: string, name: string) {
  const clean = name.trim();
  if (!clean) return { error: "Folder name is required" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("folders").update({ name: clean }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/app");
  return {};
}

export async function deleteFolder(id: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/app");
  return {};
}

export async function moveProjectToFolder(projectId: string, folderId: string | null) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("projects")
    .update({ folder_id: folderId })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/app");
  return {};
}

export async function archiveProject(projectId: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/archive");
  return {};
}

export async function unarchiveProject(projectId: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: null })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/archive");
  return {};
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/app/folders-actions.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: tsc + full suite + commit**

Run: `npx tsc --noEmit -p . && npx vitest run`

```bash
git add app/app/folders-actions.ts app/app/folders-actions.test.ts
git commit -m "feat(folders): folder + archive server actions"
```

---

### Task 3: Shared dashboard data helper + project card with counts

**Files:**
- Create: `app/app/dashboard-data.ts` (shared server helper)
- Create: `components/app/ProjectCard.tsx`
- Create: `components/app/ProjectCard.test.tsx`

**Interfaces:**
- Produces:
  - `dashboard-data.ts`: `getWorkspaceStats(supabase, projectIds: string[]): Promise<Map<string, { mockups: number; comments: number; resolved: number }>>` — calls `project_stats` per id (Promise.all) and maps by id; missing → zeros.
  - `signCovers(supabase, projects): Promise<Map<string,string>>` — factored from the existing dashboard cover-signing (batch `createSignedUrls`).
  - `ProjectCard` component with props `{ id, name, coverUrl, updatedAt, stats: { mockups, comments, resolved } }` — a card matching the current visual style with a cover, name, updated time, and the three counts (mockups/comments/resolved with icons). The card links to `/app/projects/{id}`. (The move/archive menu is added in Task 6.)

- [ ] **Step 1: Write the failing test for ProjectCard**

Create `components/app/ProjectCard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "./ProjectCard";

describe("ProjectCard", () => {
  it("shows the name and the three counts", () => {
    render(
      <ProjectCard
        id="p1"
        name="Homepage"
        coverUrl={undefined}
        updatedAt={new Date().toISOString()}
        stats={{ mockups: 3, comments: 5, resolved: 2 }}
      />,
    );
    expect(screen.getByText("Homepage")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();   // mockups
    expect(screen.getByText("5")).toBeTruthy();   // comments
    expect(screen.getByText("2")).toBeTruthy();   // resolved
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/app/ProjectCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ProjectCard`**

Create `components/app/ProjectCard.tsx`:

```tsx
import Link from "next/link";
import { timeAgo } from "@/lib/format";

function Cover({ url, name }: { url?: string; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-full w-full object-cover object-top" />;
  }
  return (
    <div className="grid h-full w-full place-items-center bg-brand-soft">
      <span className="font-mono text-3xl font-bold text-brand/40">{name.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value: number; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      {children}
      {value}
    </span>
  );
}

export function ProjectCard({
  id,
  name,
  coverUrl,
  updatedAt,
  stats,
}: {
  id: string;
  name: string;
  coverUrl?: string;
  updatedAt: string;
  stats: { mockups: number; comments: number; resolved: number };
}) {
  return (
    <Link href={`/app/projects/${id}`} className="card card-hover block overflow-hidden">
      <div className="aspect-[16/10] w-full overflow-hidden border-b bg-canvas">
        <Cover url={coverUrl} name={name} />
      </div>
      <div className="p-4">
        <h3 className="truncate font-semibold text-ink">{name}</h3>
        <div className="mt-2 flex items-center gap-3 text-xs text-faint">
          <Stat label="mockups" value={stats.mockups}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
              <path d="m4 17 5-4 4 3 3-2 4 3" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
          </Stat>
          <Stat label="comments" value={stats.comments}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 5h16v10H9l-5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
          </Stat>
          <Stat label="resolved" value={stats.resolved}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Stat>
          <span className="ml-auto font-mono">{timeAgo(updatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/app/ProjectCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implement the shared data helper**

Create `app/app/dashboard-data.ts`:

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectStats = { mockups: number; comments: number; resolved: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getWorkspaceStats(supabase: SupabaseClient<any>, projectIds: string[]) {
  const map = new Map<string, ProjectStats>();
  await Promise.all(
    projectIds.map(async (id) => {
      const { data } = await supabase.rpc("project_stats", { p: id });
      const row = Array.isArray(data) ? data[0] : data;
      map.set(id, {
        mockups: row?.mockups ?? 0,
        comments: row?.comments ?? 0,
        resolved: row?.resolved ?? 0,
      });
    }),
  );
  return map;
}

export async function signCovers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  covers: string[],
) {
  const signed = new Map<string, string>();
  const paths = covers.filter(Boolean);
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("mockups").createSignedUrls(paths, 60 * 60);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signed.set(u.path, u.signedUrl);
  }
  return signed;
}
```

> `@supabase/supabase-js` is already a dependency (it re-exports `SupabaseClient`). If the generic `<any>` import type is awkward under this project's TS config, type the param as `Awaited<ReturnType<typeof import("@/lib/supabase/server").createServerSupabase>>` instead.

- [ ] **Step 6: tsc + full suite + commit**

Run: `npx tsc --noEmit -p . && npx vitest run`

```bash
git add app/app/dashboard-data.ts components/app/ProjectCard.tsx components/app/ProjectCard.test.tsx
git commit -m "feat(dashboard): ProjectCard with counts + shared stats/cover helpers"
```

---

### Task 4: Card action menu (move to folder / archive)

**Files:**
- Create: `components/app/ProjectCardMenu.tsx`
- Create: `components/app/ProjectCardMenu.test.tsx`
- Modify: `components/app/ProjectCard.tsx` (accept an optional `menu` slot)

**Interfaces:**
- Consumes: `moveProjectToFolder`, `archiveProject` from `@/app/app/folders-actions`.
- Produces: `ProjectCardMenu` client component with props `{ projectId: string; folders: { id: string; name: string }[]; currentFolderId: string | null }`.

- [ ] **Step 1: Write the failing test**

Create `components/app/ProjectCardMenu.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const moveProjectToFolder = vi.fn().mockResolvedValue({});
const archiveProject = vi.fn().mockResolvedValue({});
vi.mock("@/app/app/folders-actions", () => ({ moveProjectToFolder, archiveProject }));

import { ProjectCardMenu } from "./ProjectCardMenu";

describe("ProjectCardMenu", () => {
  it("archives via the menu", async () => {
    render(<ProjectCardMenu projectId="p1" folders={[{ id: "f1", name: "Client" }]} currentFolderId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /project options/i }));
    fireEvent.click(screen.getByText(/archive/i));
    await waitFor(() => expect(archiveProject).toHaveBeenCalledWith("p1"));
  });

  it("moves to a folder via the menu", async () => {
    render(<ProjectCardMenu projectId="p1" folders={[{ id: "f1", name: "Client" }]} currentFolderId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /project options/i }));
    fireEvent.click(screen.getByText("Client"));
    await waitFor(() => expect(moveProjectToFolder).toHaveBeenCalledWith("p1", "f1"));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/app/ProjectCardMenu.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ProjectCardMenu`**

Create `components/app/ProjectCardMenu.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveProjectToFolder, archiveProject } from "@/app/app/folders-actions";

export function ProjectCardMenu({
  projectId,
  folders,
  currentFolderId,
}: {
  projectId: string;
  folders: { id: string; name: string }[];
  currentFolderId: string | null;
}) {
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
          <div className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-lg border bg-surface-2 p-1 shadow-lg">
            <p className="px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-faint">Move to folder</p>
            {currentFolderId && (
              <button onClick={() => run(() => moveProjectToFolder(projectId, null))} className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-[color:var(--accent)]">
                No folder (top level)
              </button>
            )}
            {folders.filter((f) => f.id !== currentFolderId).map((f) => (
              <button key={f.id} onClick={() => run(() => moveProjectToFolder(projectId, f.id))} className="block w-full truncate rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-[color:var(--accent)]">
                {f.name}
              </button>
            ))}
            {folders.length === 0 && !currentFolderId && (
              <p className="px-2.5 py-1.5 text-xs text-faint">No folders yet</p>
            )}
            <div className="my-1 border-t" />
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

- [ ] **Step 4: Add an optional `menu` slot to `ProjectCard`**

In `components/app/ProjectCard.tsx`, add `menu?: React.ReactNode` to the props type, and render it absolutely-positioned over the cover. Change the outer `<Link>` wrapper to a `<div className="card card-hover group relative overflow-hidden">` containing the `<Link>` for the cover+body, plus the menu in a corner:

Replace the component's returned JSX with:
```tsx
  return (
    <div className="card card-hover group relative overflow-hidden">
      {menu && <div className="absolute right-2 top-2 z-10">{menu}</div>}
      <Link href={`/app/projects/${id}`} className="block">
        <div className="aspect-[16/10] w-full overflow-hidden border-b bg-canvas">
          <Cover url={coverUrl} name={name} />
        </div>
        <div className="p-4">
          <h3 className="truncate font-semibold text-ink">{name}</h3>
          <div className="mt-2 flex items-center gap-3 text-xs text-faint">
            {/* ...the three <Stat> blocks and the timeAgo span, unchanged... */}
          </div>
        </div>
      </Link>
    </div>
  );
```
(Keep the three `<Stat>` blocks and the `timeAgo` span exactly as before, just moved inside the `<Link>`. Add `menu` to the destructured props.)

- [ ] **Step 5: Run tests, tsc, full suite, commit**

Run: `npx vitest run components/app/ProjectCardMenu.test.tsx components/app/ProjectCard.test.tsx && npx tsc --noEmit -p . && npx vitest run`
Expected: all pass.

```bash
git add components/app/ProjectCardMenu.tsx components/app/ProjectCardMenu.test.tsx components/app/ProjectCard.tsx
git commit -m "feat(dashboard): per-card move-to-folder / archive menu"
```

---

### Task 5: New-folder button

**Files:**
- Create: `components/app/NewFolderButton.tsx`
- Create: `components/app/NewFolderButton.test.tsx`

**Interfaces:**
- Consumes: `createFolder` from `@/app/app/folders-actions`.
- Produces: `NewFolderButton` client component (no props) — a button that reveals an inline name input; submitting calls `createFolder` and refreshes.

- [ ] **Step 1: Write the failing test**

Create `components/app/NewFolderButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const createFolder = vi.fn().mockResolvedValue({});
vi.mock("@/app/app/folders-actions", () => ({ createFolder }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { NewFolderButton } from "./NewFolderButton";

describe("NewFolderButton", () => {
  it("creates a folder from the inline input", async () => {
    render(<NewFolderButton />);
    fireEvent.click(screen.getByRole("button", { name: /new folder/i }));
    fireEvent.change(screen.getByPlaceholderText(/folder name/i), { target: { value: "Client work" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    await waitFor(() => {
      expect(createFolder).toHaveBeenCalled();
      const fd = createFolder.mock.calls[0][0] as FormData;
      expect(fd.get("name")).toBe("Client work");
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/app/NewFolderButton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `NewFolderButton`**

Create `components/app/NewFolderButton.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFolder } from "@/app/app/folders-actions";

export function NewFolderButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    const value = name.trim();
    if (!value) return;
    const fd = new FormData();
    fd.set("name", value);
    start(async () => {
      await createFolder(fd);
      setName("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary gap-1.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 11v4m-2-2h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        New folder
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
        placeholder="Folder name…"
        className="field h-10 w-44"
      />
      <button type="button" onClick={submit} disabled={pending} className="btn-primary btn-sm">Create</button>
      <button type="button" onClick={() => setOpen(false)} className="btn-secondary btn-sm">Cancel</button>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/app/NewFolderButton.test.tsx`
Expected: PASS.

- [ ] **Step 5: tsc + full suite + commit**

Run: `npx tsc --noEmit -p . && npx vitest run`

```bash
git add components/app/NewFolderButton.tsx components/app/NewFolderButton.test.tsx
git commit -m "feat(dashboard): NewFolderButton inline create"
```

---

### Task 6: Dashboard redesign (folders + project cards + top bar)

**Files:**
- Modify: `app/app/page.tsx`

**Interfaces:**
- Consumes: `getWorkspaceStats`, `signCovers` (Task 3), `ProjectCard` (Tasks 3/4), `ProjectCardMenu` (Task 4), `NewFolderButton` (Task 5), plus the existing `NotificationBell`/`ProfileMenu` (must be preserved).

- [ ] **Step 1: Rewrite the dashboard page**

Replace `app/app/page.tsx` with this (preserves auth-user read, NotificationBell, ProfileMenu, create-project form, and cover signing; adds folders + stats + card menus):

```tsx
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace, createProject } from "./actions";
import { getWorkspaceStats, signCovers, type ProjectStats } from "./dashboard-data";
import { plural, emailLocalPart } from "@/lib/format";
import { ProjectCard } from "@/components/app/ProjectCard";
import { ProjectCardMenu } from "@/components/app/ProjectCardMenu";
import { NewFolderButton } from "@/components/app/NewFolderButton";
import { NotificationBell } from "@/components/app/NotificationBell";
import { ProfileMenu } from "@/components/app/ProfileMenu";

type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  folder_id: string | null;
  archived_at: string | null;
  mockups: { id: string; file_path: string; created_at: string }[];
};

export default async function DashboardPage() {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const userEmail = authData.user?.email ?? "";
  const userName = (authData.user?.user_metadata?.name as string) || emailLocalPart(userEmail) || "";

  const [{ data: folders }, { data: projectData }] = await Promise.all([
    supabase.from("folders").select("id, name").eq("workspace_id", ws?.id ?? "").order("name"),
    supabase
      .from("projects")
      .select("id, name, created_at, folder_id, archived_at, mockups(id, file_path, created_at)")
      .eq("workspace_id", ws?.id ?? "")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const allProjects = (projectData ?? []) as ProjectRow[];
  const looseProjects = allProjects.filter((p) => !p.folder_id);
  const folderList = (folders ?? []) as { id: string; name: string }[];
  const projectCountByFolder = new Map<string, number>();
  for (const p of allProjects) if (p.folder_id) projectCountByFolder.set(p.folder_id, (projectCountByFolder.get(p.folder_id) ?? 0) + 1);

  const stats = await getWorkspaceStats(supabase, looseProjects.map((p) => p.id));
  const covers = await signCovers(
    supabase,
    looseProjects.map((p) => [...p.mockups].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.file_path).filter(Boolean) as string[],
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
          <p className="mt-1 text-sm text-muted">{ws?.name} · {plural(allProjects.length, "project")}</p>
        </div>
        <div className="flex items-center gap-2">
          <NewFolderButton />
          <form action={async (formData: FormData) => { "use server"; await createProject(formData); }} className="flex items-center gap-2">
            <input name="name" placeholder="New project…" required className="field h-10 w-44" />
            <button className="btn-primary btn-sm">New project</button>
          </form>
          <Link href="/app/members" className="btn-secondary btn-sm">Invite</Link>
          <NotificationBell />
          <ProfileMenu name={userName} email={userEmail} />
        </div>
      </div>

      {folderList.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-muted">Folders</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {folderList.map((f) => (
              <li key={f.id}>
                <Link href={`/app/folders/${f.id}`} className="card card-hover flex items-center gap-3 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{f.name}</span>
                    <span className="text-xs text-faint">{plural(projectCountByFolder.get(f.id) ?? 0, "project")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-muted">Projects</h2>
      {looseProjects.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No projects here</h3>
          <p className="mt-1 max-w-sm text-sm text-muted">Create a project above, or open a folder.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {looseProjects.map((p) => (
            <li key={p.id}>
              <ProjectCard
                id={p.id}
                name={p.name}
                coverUrl={coverFor(p)}
                updatedAt={p.created_at}
                stats={stats.get(p.id) ?? zero}
                menu={<ProjectCardMenu projectId={p.id} folders={folderList} currentFolderId={p.folder_id} />}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build + tsc + full suite**

Run: `npm run build && npx tsc --noEmit -p . && npx vitest run`
Expected: build succeeds; tsc clean; all pass.

- [ ] **Step 3: Commit**

```bash
git add app/app/page.tsx
git commit -m "feat(dashboard): folder cards + project cards with counts + top bar"
```

---

### Task 7: Folder detail route, archive route, sidebar nav

**Files:**
- Create: `app/app/folders/[folderId]/page.tsx`
- Create: `app/app/archive/page.tsx`
- Create: `components/app/UnarchiveButton.tsx`
- Modify: `components/app/AppSidebar.tsx` (nav: Dashboard · Team · Archive)

**Interfaces:**
- Consumes: `getWorkspaceStats`, `signCovers`, `ProjectCard`, `ProjectCardMenu`, `unarchiveProject`.
- Produces: `UnarchiveButton` client component with prop `{ projectId: string }`.

- [ ] **Step 1: Folder detail page**

Create `app/app/folders/[folderId]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceStats, signCovers, type ProjectStats } from "@/app/app/dashboard-data";
import { ProjectCard } from "@/components/app/ProjectCard";
import { ProjectCardMenu } from "@/components/app/ProjectCardMenu";

type Row = { id: string; name: string; created_at: string; folder_id: string | null; mockups: { file_path: string; created_at: string }[] };

export default async function FolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params;
  const supabase = await createServerSupabase();
  const { data: folder } = await supabase.from("folders").select("id, name, workspace_id").eq("id", folderId).maybeSingle();
  if (!folder) notFound();

  const { data: allFolders } = await supabase.from("folders").select("id, name").eq("workspace_id", folder.workspace_id).order("name");
  const { data: projectData } = await supabase
    .from("projects")
    .select("id, name, created_at, folder_id, mockups(file_path, created_at)")
    .eq("folder_id", folderId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const projects = (projectData ?? []) as Row[];
  const stats = await getWorkspaceStats(supabase, projects.map((p) => p.id));
  const covers = await signCovers(supabase, projects.map((p) => [...p.mockups].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.file_path).filter(Boolean) as string[]);
  const zero: ProjectStats = { mockups: 0, comments: 0, resolved: 0 };
  const folderList = (allFolders ?? []) as { id: string; name: string }[];

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/app" className="text-muted hover:text-ink">Dashboard</Link>
        <span className="text-faint">/</span>
        <span className="font-semibold text-ink">{folder.name}</span>
      </div>
      {projects.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">This folder is empty</h3>
          <p className="mt-1 text-sm text-muted">Move a project here from the dashboard's project menu.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <ProjectCard
                id={p.id}
                name={p.name}
                coverUrl={covers.get([...p.mockups].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.file_path ?? "")}
                updatedAt={p.created_at}
                stats={stats.get(p.id) ?? zero}
                menu={<ProjectCardMenu projectId={p.id} folders={folderList} currentFolderId={p.folder_id} />}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Unarchive button**

Create `components/app/UnarchiveButton.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unarchiveProject } from "@/app/app/folders-actions";

export function UnarchiveButton({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await unarchiveProject(projectId); router.refresh(); })}
      className="btn-secondary btn-sm"
    >
      {pending ? "Restoring…" : "Restore"}
    </button>
  );
}
```

- [ ] **Step 3: Archive page**

Create `app/app/archive/page.tsx`:

```tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/app/app/actions";
import { timeAgo } from "@/lib/format";
import { UnarchiveButton } from "@/components/app/UnarchiveButton";

export default async function ArchivePage() {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("projects")
    .select("id, name, archived_at")
    .eq("workspace_id", ws?.id ?? "")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  const projects = (data ?? []) as { id: string; name: string; archived_at: string }[];

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Archive</h1>
      <p className="mt-1 text-sm text-muted">Archived projects are hidden from the dashboard. Restore any to bring it back.</p>
      {projects.length === 0 ? (
        <div className="card mt-6 grid place-items-center px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">Nothing archived</h3>
        </div>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border bg-surface">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{p.name}</span>
                <span className="font-mono text-xs text-faint">archived {timeAgo(p.archived_at)}</span>
              </span>
              <UnarchiveButton projectId={p.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add Archive to the sidebar nav**

In `components/app/AppSidebar.tsx`, find the nav links section (currently "Projects" and "Members"). Rename "Projects" → "Dashboard" (still `href="/app"`), keep "Members" as "Team" (`href="/app/members"`), and add an "Archive" link (`href="/app/archive"`) with a box/archive icon, following the exact markup of the existing nav items. (Read the file to match the existing `<Link>`/active-state markup; do not restructure — only adjust labels and add the one Archive item.)

- [ ] **Step 5: Verify build + tsc + full suite**

Run: `npm run build && npx tsc --noEmit -p . && npx vitest run`
Expected: build succeeds and lists `/app/folders/[folderId]` and `/app/archive`; tsc clean; all pass.

- [ ] **Step 6: Commit**

```bash
git add app/app/folders/[folderId]/page.tsx app/app/archive/page.tsx components/app/UnarchiveButton.tsx components/app/AppSidebar.tsx
git commit -m "feat(dashboard): folder detail + archive routes + sidebar nav"
```

---

## Self-Review

**Spec coverage (Phase 4):**
- folders table + folder_id + archived_at + project_stats → Task 1. ✅
- folder/move/archive actions → Task 2. ✅
- project cards with counts → Task 3. ✅
- move-to-folder / archive card menu → Task 4. ✅
- new folder → Task 5. ✅
- dashboard: folder cards + project grid + top bar (New folder / New project / Invite), preserving bell + profile → Task 6. ✅
- folder detail route → Task 7. ✅
- archive view + restore → Task 7. ✅
- sidebar nav (Dashboard · Team · Archive) → Task 7. ✅
- **Filter/sort/search:** deferred to a fast-follow (not blocking the folder/archive core). Noted so it isn't silently dropped — add a client `DashboardToolbar` over the project list in a later task if desired.

**Placeholder scan:** No TBD/TODO; complete code throughout except the AppSidebar nav edit (Task 7 Step 4), which is described precisely because it must match the file's existing per-item markup (read-then-edit), not invent new structure. ✅

**Type consistency:** `ProjectStats` (`mockups, comments, resolved`) identical across `dashboard-data.ts`, `ProjectCard`, both pages. `ProjectCardMenu` props (`projectId, folders, currentFolderId`) identical in its test and both call sites. `project_stats(p uuid)` param name `p` matches the `rpc("project_stats", { p: id })` call. Folder action signatures match their test and consumers. ✅

**Migration-apply note:** `0009_folders.sql` applies at deploy; the dashboard's folder/stat/archive reads only function once applied (unit tests mock Supabase and the `project_stats` RPC). `folders` RLS reuses the proven `is_workspace_member`; `project_stats` gates on `can_see_project`. ✅

**Scope note:** This phase is a real dashboard redesign; the primary risk is the Task 6 rewrite of `app/app/page.tsx`. It deliberately preserves the existing create-project form, cover-signing, and the Phase 1/2 header components, adding folders/stats/menus around them rather than replacing them.
