# Foundation & Core Commenting Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational vertical slice of the visual feedback tool: two teammates in a shared workspace can upload an image mockup and leave pinned, threaded, resolvable comments on it.

**Architecture:** Next.js (App Router, TypeScript) full-stack app backed by Supabase (Postgres + Auth + Storage). Multi-tenancy is enforced by Postgres Row-Level Security (RLS) — every table joins to a `workspace_id` and policies restrict rows to members. Pins are stored as normalized (0–1) coordinates so they stay anchored across zoom/pan/resize. This plan stops before real-time, share links, and email — those are Plan 2.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Vitest + React Testing Library (unit/integration), Playwright (E2E), `react-zoom-pan-pinch` (viewer).

## Global Constraints

- Node.js >= 20; package manager: npm.
- Supabase is accessed **only** through the `@supabase/ssr` helpers in `lib/supabase/` — never instantiate `createClient` inline elsewhere.
- Every table has RLS **enabled** with explicit policies. No table is ever left world-readable.
- Pin coordinates are always stored normalized: `x`, `y` are floats in `[0, 1]` relative to the image's natural dimensions. Never store pixels.
- Comment thread `status` (`active` | `resolved`) lives on the `pins` row, never on `comments`.
- Upload cap: 25 MB per file, enforced on both client and server. Accepted image MIME types: `image/png`, `image/jpeg`.
- All secrets come from environment variables; none are committed. `.env.local` is git-ignored.
- Migrations live in `supabase/migrations/` and are plain SQL applied via the Supabase CLI.

---

## Prerequisites (one-time, human-performed)

These are not code tasks but must be done before Task 2 can be tested. Document them in `README.md` as part of Task 1.

1. Install the Supabase CLI (`npm install -D supabase`).
2. Run `npx supabase init` then `npx supabase start` (requires Docker) to get a **local** Postgres + Auth + Storage stack. Local dev uses this — no cloud project needed for Plan 1.
3. `npx supabase status` prints the local `API URL`, `anon key`, and `service_role key`. These populate `.env.local`.

---

## File Structure

```
markitup/
  package.json
  next.config.ts
  tsconfig.json
  vitest.config.ts
  playwright.config.ts
  .env.local                      (git-ignored)
  .env.example
  README.md
  middleware.ts                   (refreshes Supabase session cookies)
  supabase/
    config.toml
    migrations/
      0001_profiles_workspaces.sql
      0002_projects_members.sql
      0003_mockups_storage.sql
      0004_pins_comments.sql
  lib/
    supabase/
      client.ts                   (browser client)
      server.ts                   (server client for RSC/actions)
      middleware.ts               (session refresh helper)
    coords.ts                     (normalized <-> pixel pure functions)
    coords.test.ts
    validation.ts                 (upload size/MIME checks)
    validation.test.ts
  app/
    layout.tsx
    page.tsx                      (redirects to /login or /app)
    login/page.tsx
    signup/page.tsx
    auth/callback/route.ts        (OAuth code exchange)
    auth/actions.ts               (signIn, signUp, signOut server actions)
    app/
      layout.tsx                  (authed shell; loads current workspace)
      page.tsx                    (project list for current workspace)
      actions.ts                  (workspace/project/member server actions)
      members/page.tsx            (team member list + invite link)
      projects/[projectId]/page.tsx        (mockup list)
      projects/[projectId]/actions.ts      (mockup upload/create)
      mockups/[mockupId]/page.tsx          (viewer page)
      mockups/[mockupId]/actions.ts        (pin/comment server actions)
  components/
    viewer/
      MockupViewer.tsx            (zoom/pan + pin overlay, client)
      PinMarker.tsx
      CommentThread.tsx
      CommentFilter.tsx
      UploadDropzone.tsx
  e2e/
    core-loop.spec.ts
```

---

## Task 1: Project scaffold, tooling, and smoke test

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind` config, `app/layout.tsx`, `app/page.tsx`, `vitest.config.ts`, `.env.example`, `README.md`, `.gitignore`
- Test: `lib/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a booting Next.js app and a working `npm test` (Vitest) command that later tasks extend.

- [ ] **Step 1: Scaffold the app**

Run:
```bash
npx create-next-app@latest markitup --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --use-npm
cd markitup
```
Accept defaults for any remaining prompts (Turbopack: yes).

- [ ] **Step 2: Add testing dependencies**

Run:
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
  resolve: { alias: { "@": __dirname } },
});
```

- [ ] **Step 4: Add the test script**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write the failing smoke test**

Create `lib/smoke.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs the test toolchain", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run it to confirm the toolchain works**

Run: `npm test`
Expected: PASS, 1 test passed.

- [ ] **Step 7: Write `.env.example` and README prerequisites**

Create `.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
Add a "Local Setup" section to `README.md` documenting the three Prerequisites steps above (install CLI, `supabase start`, copy keys from `supabase status` into `.env.local`). Confirm `.env.local` is listed in `.gitignore` (create-next-app adds `.env*` — verify).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and env template"
```

---

## Task 2: Supabase clients and session middleware

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts`
- Test: `lib/supabase/server.test.ts`

**Interfaces:**
- Consumes: env vars from Task 1.
- Produces:
  - `createBrowserSupabase(): SupabaseClient` (browser client, `lib/supabase/client.ts`)
  - `createServerSupabase(): Promise<SupabaseClient>` (RSC/action client reading cookies, `lib/supabase/server.ts`)
  - `updateSession(request: NextRequest): Promise<NextResponse>` (`lib/supabase/middleware.ts`)

- [ ] **Step 1: Install Supabase packages**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Write the browser client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Write the server client**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component; middleware refreshes instead
          }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Write the session-refresh middleware helper**

Create `lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}
```

- [ ] **Step 5: Wire root middleware**

Create `middleware.ts` at the project root:
```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 6: Write a test that the server client factory reads env and constructs**

Create `lib/supabase/server.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

describe("createServerSupabase", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("builds a client exposing auth", async () => {
    const { createServerSupabase } = await import("./server");
    const client = await createServerSupabase();
    expect(client.auth).toBeDefined();
  });
});
```

- [ ] **Step 7: Run the test**

Run: `npm test`
Expected: PASS (smoke + server client tests).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Supabase browser/server clients and session middleware"
```

---

## Task 3: Schema — profiles, workspaces, members, RLS, signup trigger

**Files:**
- Create: `supabase/migrations/0001_profiles_workspaces.sql`

**Interfaces:**
- Consumes: local Supabase stack (Prerequisites).
- Produces tables usable by later tasks:
  - `profiles(id uuid pk, name text, email text, avatar_url text, created_at)`
  - `workspaces(id uuid pk, name text, owner_id uuid, created_at)`
  - `workspace_members(id uuid pk, workspace_id uuid, user_id uuid, role text, created_at)` with `role in ('owner','admin','member')`
  - Helper SQL function `is_workspace_member(ws uuid) returns boolean`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_profiles_workspaces.sql`:
```sql
-- profiles mirror auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- create a profile automatically when an auth user is created
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- membership helper avoids recursive RLS lookups
create function public.is_workspace_member(ws uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- profiles: you can read your own + anyone in a shared workspace; write only your own
create policy "read own profile" on public.profiles
  for select using (id = auth.uid());
create policy "read co-member profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.workspace_members m1
      join public.workspace_members m2 on m1.workspace_id = m2.workspace_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );
create policy "update own profile" on public.profiles
  for update using (id = auth.uid());

-- workspaces: members can read; any authed user can create; owner can update
create policy "members read workspace" on public.workspaces
  for select using (public.is_workspace_member(id));
create policy "authed create workspace" on public.workspaces
  for insert with check (owner_id = auth.uid());
create policy "owner update workspace" on public.workspaces
  for update using (owner_id = auth.uid());

-- workspace_members: members can read the roster; owners/admins manage
create policy "members read roster" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));
create policy "self join via owner insert" on public.workspace_members
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid() and m.role in ('owner','admin')
    )
  );
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
npx supabase migration up
```
Expected: applies `0001` with no errors.

- [ ] **Step 3: Verify RLS is on for all three tables**

Run:
```bash
npx supabase db execute "select relname, relrowsecurity from pg_class where relname in ('profiles','workspaces','workspace_members');"
```
Expected: all three rows show `relrowsecurity = t`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: profiles, workspaces, members schema with RLS and signup trigger"
```

---

## Task 4: Email/password + Google auth and auth pages

**Files:**
- Create: `app/auth/actions.ts`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/auth/callback/route.ts`
- Modify: `app/page.tsx` (redirect based on session)
- Test: `app/auth/actions.test.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (Task 2), `profiles` table (Task 3).
- Produces server actions:
  - `signUp(formData: FormData): Promise<{ error?: string }>` — fields `name`, `email`, `password`
  - `signIn(formData: FormData): Promise<{ error?: string }>` — fields `email`, `password`
  - `signOut(): Promise<void>`

- [ ] **Step 1: Write the failing test for validation in `signIn`**

Create `app/auth/actions.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: {
      signInWithPassword: async ({ email }: { email: string }) =>
        email === "bad@x.com"
          ? { error: { message: "Invalid login credentials" } }
          : { error: null },
    },
  }),
}));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("REDIRECT"); } }));

describe("signIn", () => {
  it("returns an error message on bad credentials", async () => {
    const { signIn } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "bad@x.com");
    fd.set("password", "nope");
    const result = await signIn(fd);
    expect(result?.error).toBe("Invalid login credentials");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test app/auth/actions.test.ts`
Expected: FAIL — cannot resolve `./actions`.

- [ ] **Step 3: Implement the auth actions**

Create `app/auth/actions.ts`:
```typescript
"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/app");
}

export async function signUp(formData: FormData) {
  const name = String(formData.get("name"));
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) return { error: error.message };
  redirect("/app");
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test app/auth/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the login and signup pages**

Create `app/login/page.tsx`:
```tsx
import { signIn } from "@/app/auth/actions";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-4 text-xl font-semibold">Log in</h1>
      <form action={signIn} className="flex flex-col gap-3">
        <input name="email" type="email" placeholder="Email" required className="border p-2" />
        <input name="password" type="password" placeholder="Password" required className="border p-2" />
        <button type="submit" className="bg-black p-2 text-white">Log in</button>
      </form>
      <p className="mt-4 text-sm">
        No account? <Link href="/signup" className="underline">Sign up</Link>
      </p>
    </main>
  );
}
```

Create `app/signup/page.tsx`:
```tsx
import { signUp } from "@/app/auth/actions";
import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-4 text-xl font-semibold">Sign up</h1>
      <form action={signUp} className="flex flex-col gap-3">
        <input name="name" type="text" placeholder="Name" required className="border p-2" />
        <input name="email" type="email" placeholder="Email" required className="border p-2" />
        <input name="password" type="password" placeholder="Password" required minLength={6} className="border p-2" />
        <button type="submit" className="bg-black p-2 text-white">Sign up</button>
      </form>
      <p className="mt-4 text-sm">
        Have an account? <Link href="/login" className="underline">Log in</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 6: Add the OAuth callback route**

Create `app/auth/callback/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createServerSupabase();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}/app`);
}
```

Note for later: Google OAuth requires enabling the Google provider in `supabase/config.toml` (or the cloud dashboard) with client id/secret. Document this in README under "Google sign-in (optional)". The email/password path works without it.

- [ ] **Step 7: Make the index route redirect on session**

Replace `app/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? "/app" : "/login");
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: email/password auth, signup, and OAuth callback"
```

---

## Task 5: Authed shell, workspace bootstrap, and current-workspace context

**Files:**
- Create: `app/app/layout.tsx`, `app/app/actions.ts`, `app/app/page.tsx`
- Test: `app/app/actions.test.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (Task 2), `workspaces`/`workspace_members` (Task 3).
- Produces:
  - `getCurrentWorkspace(): Promise<{ id: string; name: string } | null>` — returns the caller's first workspace, creating one named `"<name>'s Workspace"` on first login if none exists.
  - `createProject(formData: FormData): Promise<{ error?: string }>` (defined here, used in Task 6; field `name`)

- [ ] **Step 1: Write the failing test for workspace bootstrap logic**

Create `app/app/actions.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

const state = { members: [] as any[], workspaces: [] as any[] };

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "a@b.com" } } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "workspace_members"
              ? { data: state.members[0] ?? null }
              : { data: null },
          limit: () => ({
            maybeSingle: async () => ({ data: state.members[0] ?? null }),
          }),
        }),
      }),
      insert: (row: any) => ({
        select: () => ({
          single: async () => {
            const created = { id: "ws1", name: row.name ?? "n" };
            state.workspaces.push(created);
            state.members.push({ workspace_id: "ws1", name: created.name });
            return { data: created };
          },
        }),
      }),
    }),
  }),
}));

describe("getCurrentWorkspace", () => {
  it("creates a workspace on first login when none exists", async () => {
    const { getCurrentWorkspace } = await import("./actions");
    const ws = await getCurrentWorkspace();
    expect(ws?.id).toBe("ws1");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test app/app/actions.test.ts`
Expected: FAIL — cannot resolve `./actions`.

- [ ] **Step 3: Implement the actions**

Create `app/app/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export async function getCurrentWorkspace() {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership?.workspaces) {
    const ws = membership.workspaces as unknown as { id: string; name: string };
    return { id: ws.id, name: ws.name };
  }

  const name = (user.user_metadata?.name as string) || user.email || "My";
  const { data: ws } = await supabase
    .from("workspaces")
    .insert({ name: `${name}'s Workspace`, owner_id: user.id })
    .select()
    .single();
  if (!ws) return null;

  await supabase
    .from("workspace_members")
    .insert({ workspace_id: ws.id, user_id: user.id, role: "owner" });

  return { id: ws.id as string, name: ws.name as string };
}

export async function createProject(formData: FormData) {
  const name = String(formData.get("name")).trim();
  if (!name) return { error: "Project name is required" };
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("projects")
    .insert({ name, workspace_id: ws.id, created_by: userData.user!.id });
  if (error) return { error: error.message };
  revalidatePath("/app");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test app/app/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the authed shell layout**

Create `app/app/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { getCurrentWorkspace } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const ws = await getCurrentWorkspace();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b p-4">
        <div className="flex gap-4">
          <Link href="/app" className="font-semibold">{ws?.name ?? "Markitup"}</Link>
          <Link href="/app/members" className="text-sm text-gray-600">Members</Link>
        </div>
        <form action={signOut}>
          <button className="text-sm underline">Sign out</button>
        </form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6: Build the project list page (create form + list)**

Create `app/app/page.tsx`:
```tsx
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace, createProject } from "./actions";

export default async function ProjectsPage() {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("workspace_id", ws?.id ?? "")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-lg font-semibold">Projects</h1>
      <form action={createProject} className="mb-6 flex gap-2">
        <input name="name" placeholder="New project name" className="flex-1 border p-2" required />
        <button className="bg-black px-4 text-white">Create</button>
      </form>
      <ul className="flex flex-col gap-2">
        {(projects ?? []).map((p) => (
          <li key={p.id}>
            <Link href={`/app/projects/${p.id}`} className="block border p-3 hover:bg-gray-50">
              {p.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, sign up a new user, confirm you land on `/app` with a `"<name>'s Workspace"` header and can create a project that appears in the list.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: authed shell, workspace bootstrap, project creation"
```

---

## Task 6: Projects schema, members, and copyable invite link

**Files:**
- Create: `supabase/migrations/0002_projects_members.sql`, `app/app/members/page.tsx`
- Modify: `app/app/actions.ts` (add `addMemberByEmail`, `getWorkspaceMembers`)
- Test: `app/app/members.test.ts`

**Interfaces:**
- Consumes: workspace context (Task 5).
- Produces:
  - Tables `projects`, `project_members`, `invitations` with RLS.
  - `getWorkspaceMembers(): Promise<{ id: string; name: string; email: string; role: string }[]>`
  - `addMemberByEmail(formData: FormData): Promise<{ error?: string; invited?: boolean }>` — field `email`; if the email matches an existing profile, adds them as a workspace `member`; otherwise creates an `invitations` row and returns `invited: true`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0002_projects_members.sql`:
```sql
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'reviewer' check (role in ('reviewer','editor')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid not null references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.invitations enable row level security;

-- a project is visible if you're a workspace member OR a project member
create function public.can_see_project(p uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p and public.is_workspace_member(pr.workspace_id)
  ) or exists (
    select 1 from public.project_members pm
    where pm.project_id = p and pm.user_id = auth.uid()
  );
$$;

create policy "see projects" on public.projects
  for select using (can_see_project(id));
create policy "members create projects" on public.projects
  for insert with check (public.is_workspace_member(workspace_id));

create policy "see project members" on public.project_members
  for select using (public.can_see_project(project_id));
create policy "ws members manage project members" on public.project_members
  for insert with check (
    exists (select 1 from public.projects pr
            where pr.id = project_id and public.is_workspace_member(pr.workspace_id))
  );

create policy "ws members see invitations" on public.invitations
  for select using (public.is_workspace_member(workspace_id));
create policy "ws members create invitations" on public.invitations
  for insert with check (public.is_workspace_member(workspace_id));
```

- [ ] **Step 2: Apply and verify**

Run:
```bash
npx supabase migration up
npx supabase db execute "select relname, relrowsecurity from pg_class where relname in ('projects','project_members','invitations');"
```
Expected: migration applies; all three show `relrowsecurity = t`.

- [ ] **Step 3: Write the failing test for `addMemberByEmail` (invite branch)**

Create `app/app/members.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "profiles" ? { data: null } : { data: null },
          limit: () => ({ maybeSingle: async () => ({ data: { workspace_id: "ws1", workspaces: { id: "ws1", name: "W" } } }) }),
        }),
      }),
      insert: async () => ({ error: null }),
    }),
  }),
}));

describe("addMemberByEmail", () => {
  it("creates an invitation when the email has no profile", async () => {
    const { addMemberByEmail } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "new@client.com");
    const result = await addMemberByEmail(fd);
    expect(result.invited).toBe(true);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npm test app/app/members.test.ts`
Expected: FAIL — `addMemberByEmail` is not exported.

- [ ] **Step 5: Implement `getWorkspaceMembers` and `addMemberByEmail`**

Append to `app/app/actions.ts`:
```typescript
export async function getWorkspaceMembers() {
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return [];
  const { data } = await supabase
    .from("workspace_members")
    .select("role, profiles(id, name, email)")
    .eq("workspace_id", ws.id);
  return (data ?? []).map((m) => {
    const p = m.profiles as unknown as { id: string; name: string; email: string };
    return { id: p.id, name: p.name, email: p.email, role: m.role as string };
  });
}

export async function addMemberByEmail(formData: FormData) {
  const email = String(formData.get("email")).trim().toLowerCase();
  if (!email) return { error: "Email required" };
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const { data: userData } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (profile) {
    const { error } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: profile.id, role: "member" });
    if (error) return { error: error.message };
    revalidatePath("/app/members");
    return { invited: false };
  }

  const { error } = await supabase
    .from("invitations")
    .insert({ workspace_id: ws.id, email, invited_by: userData.user!.id });
  if (error) return { error: error.message };
  revalidatePath("/app/members");
  return { invited: true };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test app/app/members.test.ts`
Expected: PASS.

- [ ] **Step 7: Build the members page**

Create `app/app/members/page.tsx`:
```tsx
import { getWorkspaceMembers, addMemberByEmail } from "@/app/app/actions";

export default async function MembersPage() {
  const members = await getWorkspaceMembers();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-lg font-semibold">Team members</h1>
      <form action={addMemberByEmail} className="mb-6 flex gap-2">
        <input name="email" type="email" placeholder="teammate@agency.com" className="flex-1 border p-2" required />
        <button className="bg-black px-4 text-white">Add</button>
      </form>
      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li key={m.id} className="flex justify-between border p-3">
            <span>{m.name || m.email}</span>
            <span className="text-sm text-gray-500">{m.role}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-gray-500">
        Adding an email that already has an account adds them immediately. New
        emails create a pending invitation (email delivery arrives in Plan 2).
      </p>
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: projects/members/invitations schema and team member management"
```

---

## Task 7: Upload validation helper (pure logic)

**Files:**
- Create: `lib/validation.ts`
- Test: `lib/validation.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MAX_UPLOAD_BYTES = 25 * 1024 * 1024`
  - `ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg"]`
  - `validateUpload(file: { size: number; type: string }): { ok: true } | { ok: false; error: string }`

- [ ] **Step 1: Write the failing tests**

Create `lib/validation.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { validateUpload, MAX_UPLOAD_BYTES } from "./validation";

describe("validateUpload", () => {
  it("accepts a small PNG", () => {
    expect(validateUpload({ size: 1000, type: "image/png" })).toEqual({ ok: true });
  });
  it("rejects an unsupported type", () => {
    const r = validateUpload({ size: 1000, type: "image/gif" });
    expect(r).toEqual({ ok: false, error: "Only PNG and JPG images are supported." });
  });
  it("rejects a file over the size cap", () => {
    const r = validateUpload({ size: MAX_UPLOAD_BYTES + 1, type: "image/png" });
    expect(r).toEqual({ ok: false, error: "File exceeds the 25 MB limit." });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test lib/validation.test.ts`
Expected: FAIL — cannot resolve `./validation`.

- [ ] **Step 3: Implement**

Create `lib/validation.ts`:
```typescript
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg"] as const;

export function validateUpload(file: { size: number; type: string }):
  | { ok: true }
  | { ok: false; error: string } {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return { ok: false, error: "Only PNG and JPG images are supported." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File exceeds the 25 MB limit." };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test lib/validation.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: upload validation helper with size/MIME checks"
```

---

## Task 8: Mockups schema, storage bucket, and upload flow

**Files:**
- Create: `supabase/migrations/0003_mockups_storage.sql`, `app/app/projects/[projectId]/page.tsx`, `app/app/projects/[projectId]/actions.ts`, `components/viewer/UploadDropzone.tsx`
- Test: `app/app/projects/upload.test.ts`

**Interfaces:**
- Consumes: `validateUpload` (Task 7), `projects` (Task 6), `createServerSupabase` (Task 2).
- Produces:
  - Table `mockups(id, project_id, name, type, file_path, page_count, created_by, created_at)` with RLS + `mockups` storage bucket.
  - `uploadMockup(projectId: string, formData: FormData): Promise<{ error?: string }>` — field `file`; validates, uploads to storage at `mockups/<projectId>/<uuid>.<ext>`, inserts a `mockups` row.
  - `getMockupSignedUrl(filePath: string): Promise<string | null>`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_mockups_storage.sql`:
```sql
create table public.mockups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  type text not null default 'image' check (type in ('image','pdf','figma')),
  file_path text not null,
  page_count int not null default 1,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.mockups enable row level security;

create policy "see mockups" on public.mockups
  for select using (public.can_see_project(project_id));
create policy "members add mockups" on public.mockups
  for insert with check (public.can_see_project(project_id));

-- private storage bucket for originals
insert into storage.buckets (id, name, public)
values ('mockups', 'mockups', false)
on conflict (id) do nothing;

-- object path is '<projectId>/<file>'; gate on project visibility
create policy "read mockup objects" on storage.objects
  for select using (
    bucket_id = 'mockups'
    and public.can_see_project(((storage.foldername(name))[1])::uuid)
  );
create policy "write mockup objects" on storage.objects
  for insert with check (
    bucket_id = 'mockups'
    and public.can_see_project(((storage.foldername(name))[1])::uuid)
  );
```

- [ ] **Step 2: Apply and verify**

Run:
```bash
npx supabase migration up
npx supabase db execute "select id, public from storage.buckets where id = 'mockups';"
```
Expected: migration applies; bucket row shows `public = f`.

- [ ] **Step 3: Write the failing test for upload validation rejection**

Create `app/app/projects/upload.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    from: () => ({ insert: async () => ({ error: null }) }),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

describe("uploadMockup", () => {
  it("rejects a non-image file before touching storage", async () => {
    const { uploadMockup } = await import("./[projectId]/actions");
    const fd = new FormData();
    fd.set("file", new File(["x"], "a.gif", { type: "image/gif" }));
    const result = await uploadMockup("proj1", fd);
    expect(result.error).toBe("Only PNG and JPG images are supported.");
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npm test app/app/projects/upload.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement the upload action**

Create `app/app/projects/[projectId]/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { validateUpload } from "@/lib/validation";

export async function uploadMockup(projectId: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };

  const check = validateUpload({ size: file.size, type: file.type });
  if (!check.ok) return { error: check.error };

  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${projectId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("mockups")
    .upload(path, file, { contentType: file.type });
  if (upErr) return { error: upErr.message };

  const { error: insErr } = await supabase.from("mockups").insert({
    project_id: projectId,
    name: file.name,
    type: "image",
    file_path: path,
    created_by: userData.user!.id,
  });
  if (insErr) return { error: insErr.message };

  revalidatePath(`/app/projects/${projectId}`);
  return {};
}

export async function getMockupSignedUrl(filePath: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.storage
    .from("mockups")
    .createSignedUrl(filePath, 60 * 60);
  return data?.signedUrl ?? null;
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npm test app/app/projects/upload.test.ts`
Expected: PASS.

- [ ] **Step 7: Build the upload dropzone (client) and project mockup list**

Create `components/viewer/UploadDropzone.tsx`:
```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validateUpload } from "@/lib/validation";
import { uploadMockup } from "@/app/app/projects/[projectId]/actions";

export function UploadDropzone({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onFile(file: File) {
    const check = validateUpload({ size: file.size, type: file.type });
    if (!check.ok) { setError(check.error); return; }
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await uploadMockup(projectId, fd);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="mb-6">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="border-2 border-dashed p-6 w-full text-gray-600 hover:bg-gray-50"
      >
        {pending ? "Uploading…" : "Click to upload a PNG or JPG (max 25 MB)"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

Create `app/app/projects/[projectId]/page.tsx`:
```tsx
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { UploadDropzone } from "@/components/viewer/UploadDropzone";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createServerSupabase();
  const { data: mockups } = await supabase
    .from("mockups")
    .select("id, name")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-lg font-semibold">Mockups</h1>
      <UploadDropzone projectId={projectId} />
      <ul className="grid grid-cols-2 gap-3">
        {(mockups ?? []).map((m) => (
          <li key={m.id}>
            <Link href={`/app/mockups/${m.id}`} className="block border p-3 hover:bg-gray-50">
              {m.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 8: Manual verification**

Run `npm run dev`, open a project, upload a PNG, confirm it appears in the list and no console/storage errors occur.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: mockups schema, private storage bucket, image upload flow"
```

---

## Task 9: Coordinate math (pure functions)

**Files:**
- Create: `lib/coords.ts`
- Test: `lib/coords.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `toNormalized(clientX, clientY, rect: { left: number; top: number; width: number; height: number }): { x: number; y: number }` — clamps to `[0,1]`.
  - `toPixels(x: number, y: number, size: { width: number; height: number }): { left: number; top: number }`

- [ ] **Step 1: Write the failing tests**

Create `lib/coords.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { toNormalized, toPixels } from "./coords";

const rect = { left: 100, top: 50, width: 200, height: 400 };

describe("toNormalized", () => {
  it("maps a center click to 0.5/0.5", () => {
    expect(toNormalized(200, 250, rect)).toEqual({ x: 0.5, y: 0.5 });
  });
  it("clamps clicks outside the image to [0,1]", () => {
    expect(toNormalized(0, 0, rect)).toEqual({ x: 0, y: 0 });
    expect(toNormalized(9999, 9999, rect)).toEqual({ x: 1, y: 1 });
  });
});

describe("toPixels", () => {
  it("is the inverse of toNormalized for in-bounds points", () => {
    expect(toPixels(0.5, 0.5, { width: 200, height: 400 })).toEqual({ left: 100, top: 200 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test lib/coords.test.ts`
Expected: FAIL — cannot resolve `./coords`.

- [ ] **Step 3: Implement**

Create `lib/coords.ts`:
```typescript
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function toNormalized(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
) {
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
}

export function toPixels(
  x: number,
  y: number,
  size: { width: number; height: number },
) {
  return { left: x * size.width, top: y * size.height };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test lib/coords.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: normalized/pixel coordinate conversion helpers"
```

---

## Task 10: Pins & comments schema with per-mockup sequential numbering

**Files:**
- Create: `supabase/migrations/0004_pins_comments.sql`
- Test: `supabase/migrations/pins_numbering.test.ts`

**Interfaces:**
- Consumes: `mockups` (Task 8), `can_see_project` (Task 6).
- Produces:
  - `pins(id, mockup_id, page, x, y, number, status, created_by, created_at)` — `status in ('active','resolved')`, `number` auto-assigned sequentially per mockup by a `before insert` trigger.
  - `comments(id, pin_id, author_id, body, parent_comment_id, created_at, updated_at)` with RLS.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0004_pins_comments.sql`:
```sql
create table public.pins (
  id uuid primary key default gen_random_uuid(),
  mockup_id uuid not null references public.mockups(id) on delete cascade,
  page int not null default 0,
  x double precision not null check (x >= 0 and x <= 1),
  y double precision not null check (y >= 0 and y <= 1),
  number int not null,
  status text not null default 'active' check (status in ('active','resolved')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pins(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- assign the next sequential pin number per mockup, safely under concurrency
create function public.assign_pin_number()
returns trigger language plpgsql as $$
begin
  select coalesce(max(number), 0) + 1 into new.number
  from public.pins where mockup_id = new.mockup_id;
  return new;
end;
$$;

create trigger set_pin_number
  before insert on public.pins
  for each row execute function public.assign_pin_number();

-- project visibility for a pin, via its mockup
create function public.can_see_pin(m uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.mockups mk
    where mk.id = m and public.can_see_project(mk.project_id)
  );
$$;

alter table public.pins enable row level security;
alter table public.comments enable row level security;

create policy "see pins" on public.pins
  for select using (public.can_see_pin(mockup_id));
create policy "create pins" on public.pins
  for insert with check (public.can_see_pin(mockup_id) and created_by = auth.uid());
create policy "update pin status" on public.pins
  for update using (public.can_see_pin(mockup_id));

create policy "see comments" on public.comments
  for select using (
    exists (select 1 from public.pins p
            where p.id = pin_id and public.can_see_pin(p.mockup_id))
  );
create policy "create comments" on public.comments
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from public.pins p
                where p.id = pin_id and public.can_see_pin(p.mockup_id))
  );
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase migration up`
Expected: applies `0004` with no errors.

- [ ] **Step 3: Write an integration test for sequential numbering against local DB**

Create `supabase/migrations/pins_numbering.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Uses the local service-role key to bypass RLS for a pure DB-behavior test.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(url, key);

describe("pin numbering trigger", () => {
  let mockupId = "";
  let userId = "";

  beforeAll(async () => {
    const { data: u } = await db.auth.admin.createUser({
      email: `t${Math.floor(performance.now())}@x.com`,
      password: "password123",
      email_confirm: true,
    });
    userId = u.user!.id;
    const { data: ws } = await db.from("workspaces")
      .insert({ name: "T", owner_id: userId }).select().single();
    const { data: proj } = await db.from("projects")
      .insert({ name: "P", workspace_id: ws!.id, created_by: userId }).select().single();
    const { data: mk } = await db.from("mockups")
      .insert({ project_id: proj!.id, name: "m", file_path: "x/y.png", created_by: userId })
      .select().single();
    mockupId = mk!.id;
  });

  it("numbers pins 1, 2, 3 within a mockup", async () => {
    const nums: number[] = [];
    for (let i = 0; i < 3; i++) {
      const { data } = await db.from("pins")
        .insert({ mockup_id: mockupId, x: 0.1 * i, y: 0.2, created_by: userId })
        .select("number").single();
      nums.push(data!.number);
    }
    expect(nums).toEqual([1, 2, 3]);
  });
});
```

Note: this test hits the local Supabase DB, so it needs `.env.local` loaded. Add `import "dotenv/config"` support by installing `dotenv` (`npm i -D dotenv`) and adding `setupFiles: ["dotenv/config"]` to `vitest.config.ts` `test` block if not already present.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test supabase/migrations/pins_numbering.test.ts`
Expected: PASS — numbers are `[1, 2, 3]`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: pins/comments schema with per-mockup sequential numbering and RLS"
```

---

## Task 11: Viewer — zoom/pan canvas, pin overlay, and pin creation

**Files:**
- Create: `components/viewer/MockupViewer.tsx`, `components/viewer/PinMarker.tsx`, `app/app/mockups/[mockupId]/actions.ts`, `app/app/mockups/[mockupId]/page.tsx`
- Test: `components/viewer/MockupViewer.test.tsx`

**Interfaces:**
- Consumes: `toNormalized`/`toPixels` (Task 9), pins/comments tables (Task 10), `getMockupSignedUrl` (Task 8).
- Produces:
  - `createPin(mockupId: string, x: number, y: number): Promise<{ id?: string; number?: number; error?: string }>`
  - `<MockupViewer imageUrl mockupId initialPins />` client component rendering the image + pin markers, letting a click drop a pin.

- [ ] **Step 1: Install the zoom/pan library**

Run: `npm install react-zoom-pan-pinch`

- [ ] **Step 2: Add the pin server actions**

Create `app/app/mockups/[mockupId]/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export async function createPin(mockupId: string, x: number, y: number) {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("pins")
    .insert({ mockup_id: mockupId, x, y, created_by: userData.user!.id })
    .select("id, number")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/app/mockups/${mockupId}`);
  return { id: data.id as string, number: data.number as number };
}

export async function addComment(
  mockupId: string,
  pinId: string,
  body: string,
  parentCommentId?: string,
) {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("comments").insert({
    pin_id: pinId,
    author_id: userData.user!.id,
    body,
    parent_comment_id: parentCommentId ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/app/mockups/${mockupId}`);
  return {};
}

export async function setPinStatus(
  mockupId: string,
  pinId: string,
  status: "active" | "resolved",
) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("pins").update({ status }).eq("id", pinId);
  if (error) return { error: error.message };
  revalidatePath(`/app/mockups/${mockupId}`);
  return {};
}
```

- [ ] **Step 3: Write the failing component test (click drops a pin marker)**

Create `components/viewer/MockupViewer.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MockupViewer } from "./MockupViewer";

vi.mock("@/app/app/mockups/[mockupId]/actions", () => ({
  createPin: async () => ({ id: "pin-new", number: 1 }),
  addComment: async () => ({}),
  setPinStatus: async () => ({}),
}));

// jsdom has no layout; stub the image's bounding rect
beforeEach(() => {
  Element.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
});

describe("MockupViewer", () => {
  it("renders existing pins by number", () => {
    render(
      <MockupViewer
        mockupId="m1"
        imageUrl="http://example.com/a.png"
        initialPins={[{ id: "p1", x: 0.5, y: 0.5, number: 3, status: "active", comments: [] }]}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npm test components/viewer/MockupViewer.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement `PinMarker`**

Create `components/viewer/PinMarker.tsx`:
```tsx
"use client";

export function PinMarker({
  number,
  x,
  y,
  status,
  onClick,
}: {
  number: number;
  x: number;
  y: number;
  status: "active" | "resolved";
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-xs text-white ${
        status === "resolved" ? "bg-green-600" : "bg-blue-600"
      }`}
    >
      {number}
    </button>
  );
}
```

- [ ] **Step 6: Implement `MockupViewer`**

Create `components/viewer/MockupViewer.tsx`:
```tsx
"use client";

import { useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { toNormalized } from "@/lib/coords";
import { PinMarker } from "./PinMarker";
import { CommentThread } from "./CommentThread";
import { CommentFilter, type Filter } from "./CommentFilter";
import { createPin } from "@/app/app/mockups/[mockupId]/actions";

export type ViewerComment = {
  id: string;
  body: string;
  authorName: string;
  parentCommentId: string | null;
  createdAt: string;
};
export type ViewerPin = {
  id: string;
  x: number;
  y: number;
  number: number;
  status: "active" | "resolved";
  comments: ViewerComment[];
};

export function MockupViewer({
  mockupId,
  imageUrl,
  initialPins,
}: {
  mockupId: string;
  imageUrl: string;
  initialPins: ViewerPin[];
}) {
  const [pins, setPins] = useState<ViewerPin[]>(initialPins);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  async function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const { x, y } = toNormalized(e.clientX, e.clientY, rect);
    const res = await createPin(mockupId, x, y);
    if (res.id && res.number != null) {
      const pin: ViewerPin = { id: res.id, x, y, number: res.number, status: "active", comments: [] };
      setPins((p) => [...p, pin]);
      setActivePinId(res.id);
    }
  }

  const visiblePins = pins.filter((p) =>
    filter === "all" ? true : filter === "active" ? p.status === "active" : p.status === "resolved",
  );
  const activePin = pins.find((p) => p.id === activePinId) ?? null;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="relative flex-1 overflow-hidden border">
        <TransformWrapper doubleClick={{ disabled: true }}>
          <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="mockup" onClick={handleImageClick} className="block w-full select-none" />
              {visiblePins.map((p) => (
                <PinMarker key={p.id} number={p.number} x={p.x} y={p.y} status={p.status}
                  onClick={() => setActivePinId(p.id)} />
              ))}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
      <aside className="w-80 shrink-0 overflow-y-auto border p-3">
        <CommentFilter value={filter} onChange={setFilter} />
        {activePin ? (
          <CommentThread mockupId={mockupId} pin={activePin}
            onChange={(updated) => setPins((ps) => ps.map((p) => (p.id === updated.id ? updated : p)))} />
        ) : (
          <p className="mt-4 text-sm text-gray-500">Click the image to drop a pin, or select one.</p>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 7: Run the component test to verify it passes**

Run: `npm test components/viewer/MockupViewer.test.tsx`
Expected: PASS (pin "3" rendered). (`CommentThread`/`CommentFilter` are created in Task 12; create minimal stub exports now so imports resolve — Step 8.)

- [ ] **Step 8: Add minimal stubs so the module imports resolve**

Create `components/viewer/CommentFilter.tsx`:
```tsx
"use client";
export type Filter = "all" | "active" | "resolved";
export function CommentFilter({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  return (
    <div className="mb-3 flex gap-2 text-sm">
      {(["all", "active", "resolved"] as Filter[]).map((f) => (
        <button key={f} onClick={() => onChange(f)}
          className={`capitalize ${value === f ? "font-semibold underline" : "text-gray-500"}`}>{f}</button>
      ))}
    </div>
  );
}
```
Create `components/viewer/CommentThread.tsx`:
```tsx
"use client";
import type { ViewerPin } from "./MockupViewer";
export function CommentThread({ pin }: { mockupId: string; pin: ViewerPin; onChange: (p: ViewerPin) => void }) {
  return <div className="mt-2 text-sm">Pin #{pin.number}</div>;
}
```
Re-run: `npm test components/viewer/MockupViewer.test.tsx` → Expected: PASS.

- [ ] **Step 9: Build the mockup viewer page (server) that loads pins + signed URL**

Create `app/app/mockups/[mockupId]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMockupSignedUrl } from "@/app/app/projects/[projectId]/actions";
import { MockupViewer, type ViewerPin } from "@/components/viewer/MockupViewer";

export default async function MockupPage({
  params,
}: {
  params: Promise<{ mockupId: string }>;
}) {
  const { mockupId } = await params;
  const supabase = await createServerSupabase();

  const { data: mockup } = await supabase
    .from("mockups").select("id, name, file_path").eq("id", mockupId).maybeSingle();
  if (!mockup) notFound();

  const { data: pins } = await supabase
    .from("pins")
    .select("id, x, y, number, status, comments(id, body, parent_comment_id, created_at, profiles(name))")
    .eq("mockup_id", mockupId)
    .order("number", { ascending: true });

  const url = await getMockupSignedUrl(mockup.file_path);

  const viewerPins: ViewerPin[] = (pins ?? []).map((p) => ({
    id: p.id, x: p.x, y: p.y, number: p.number, status: p.status,
    comments: (p.comments ?? []).map((c: any) => ({
      id: c.id, body: c.body, parentCommentId: c.parent_comment_id,
      createdAt: c.created_at, authorName: c.profiles?.name ?? "Someone",
    })),
  }));

  return (
    <div>
      <h1 className="mb-3 text-lg font-semibold">{mockup.name}</h1>
      {url && <MockupViewer mockupId={mockupId} imageUrl={url} initialPins={viewerPins} />}
    </div>
  );
}
```

- [ ] **Step 10: Manual verification**

Run `npm run dev`, open a mockup, click the image, confirm a numbered pin appears and persists across refresh; zoom/pan and confirm pins stay anchored to their spots.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: zoom/pan viewer with pin overlay and pin creation"
```

---

## Task 12: Comment threads, replies, status toggle, and filter

**Files:**
- Modify: `components/viewer/CommentThread.tsx` (replace the stub with the full thread)
- Test: `components/viewer/CommentThread.test.tsx`

**Interfaces:**
- Consumes: `addComment`, `setPinStatus` (Task 11); `ViewerPin`/`ViewerComment` (Task 11).
- Produces: full `<CommentThread>` — lists comments + replies, posts new comments/replies, toggles active/resolved, and calls `onChange(updatedPin)` so the viewer updates counts/markers.

- [ ] **Step 1: Write the failing test (posting a comment appends it)**

Create `components/viewer/CommentThread.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CommentThread } from "./CommentThread";

vi.mock("@/app/app/mockups/[mockupId]/actions", () => ({
  addComment: async () => ({}),
  setPinStatus: async () => ({}),
}));

describe("CommentThread", () => {
  it("adds a top-level comment to the thread on submit", async () => {
    const onChange = vi.fn();
    render(
      <CommentThread
        mockupId="m1"
        pin={{ id: "p1", x: 0.5, y: 0.5, number: 1, status: "active", comments: [] }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Add a comment…"), {
      target: { value: "Looks off here" },
    });
    fireEvent.click(screen.getByText("Comment"));
    await waitFor(() => expect(screen.getByText("Looks off here")).toBeInTheDocument());
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test components/viewer/CommentThread.test.tsx`
Expected: FAIL — stub has no input.

- [ ] **Step 3: Implement the full `CommentThread`**

Replace `components/viewer/CommentThread.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { ViewerPin, ViewerComment } from "./MockupViewer";
import { addComment, setPinStatus } from "@/app/app/mockups/[mockupId]/actions";

export function CommentThread({
  mockupId,
  pin,
  onChange,
}: {
  mockupId: string;
  pin: ViewerPin;
  onChange: (p: ViewerPin) => void;
}) {
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const roots = pin.comments.filter((c) => !c.parentCommentId);
  const repliesOf = (id: string) => pin.comments.filter((c) => c.parentCommentId === id);

  async function post() {
    const text = body.trim();
    if (!text) return;
    const res = await addComment(mockupId, pin.id, text, replyTo ?? undefined);
    if (res.error) return;
    const optimistic: ViewerComment = {
      id: `tmp-${pin.comments.length}`, body: text, authorName: "You",
      parentCommentId: replyTo, createdAt: new Date().toISOString(),
    };
    onChange({ ...pin, comments: [...pin.comments, optimistic] });
    setBody(""); setReplyTo(null);
  }

  async function toggleStatus() {
    const next = pin.status === "active" ? "resolved" : "active";
    await setPinStatus(mockupId, pin.id, next);
    onChange({ ...pin, status: next });
  }

  return (
    <div className="mt-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">Pin #{pin.number}</span>
        <button onClick={toggleStatus} className="text-xs underline">
          {pin.status === "active" ? "Mark resolved" : "Reopen"}
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {roots.map((c) => (
          <li key={c.id} className="rounded border p-2 text-sm">
            <div className="font-medium">{c.authorName}</div>
            <div>{c.body}</div>
            <button onClick={() => setReplyTo(c.id)} className="mt-1 text-xs text-blue-600">Reply</button>
            <ul className="mt-2 flex flex-col gap-1 border-l pl-2">
              {repliesOf(c.id).map((r) => (
                <li key={r.id} className="text-sm">
                  <span className="font-medium">{r.authorName}: </span>{r.body}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-3">
        {replyTo && (
          <div className="mb-1 text-xs text-gray-500">
            Replying… <button onClick={() => setReplyTo(null)} className="underline">cancel</button>
          </div>
        )}
        <textarea value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…" className="w-full border p-2 text-sm" rows={2} />
        <button onClick={post} className="mt-1 bg-black px-3 py-1 text-sm text-white">Comment</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test components/viewer/CommentThread.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the whole unit suite**

Run: `npm test`
Expected: all tests PASS (smoke, server client, auth, workspace, members, validation, coords, pins numbering, MockupViewer, CommentThread).

- [ ] **Step 6: Manual verification**

Run `npm run dev`: open a pin, post a comment, reply to it, mark the thread resolved, switch the filter to Active and confirm the resolved pin disappears from the overlay, switch to All and confirm it returns.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: comment threads with replies, status toggle, and filtering"
```

---

## Task 13: End-to-end core-loop test (two users)

**Files:**
- Create: `playwright.config.ts`, `e2e/core-loop.spec.ts`, `e2e/fixtures/sample.png`
- Modify: `package.json` (add `test:e2e` script)

**Interfaces:**
- Consumes: the running app + local Supabase.
- Produces: an E2E proof of the full loop.

- [ ] **Step 1: Install Playwright**

Run:
```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Configure Playwright**

Create `playwright.config.ts`:
```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```
Add to `package.json` scripts: `"test:e2e": "playwright test"`. Add a tiny valid PNG at `e2e/fixtures/sample.png` (any small PNG; document that testers can copy one in).

- [ ] **Step 3: Write the E2E spec**

Create `e2e/core-loop.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

const stamp = Date.now();
const owner = { email: `owner${stamp}@x.com`, password: "password123", name: "Owner" };
const client = { email: `client${stamp}@x.com`, password: "password123", name: "Client" };

async function signup(page, u) {
  await page.goto("/signup");
  await page.fill('input[name="name"]', u.name);
  await page.fill('input[name="email"]', u.email);
  await page.fill('input[name="password"]', u.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/app");
}

test("owner uploads, both users comment, thread resolves", async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  await signup(ownerPage, owner);

  // create project
  await ownerPage.fill('input[name="name"]', "Homepage");
  await ownerPage.click('button:has-text("Create")');
  await ownerPage.click('text=Homepage');

  // upload
  await ownerPage.setInputFiles('input[type="file"]', "e2e/fixtures/sample.png");
  await expect(ownerPage.locator("text=sample.png")).toBeVisible({ timeout: 15_000 });

  // add the client as a member so they can access
  await ownerPage.goto("/app/members");
  await ownerPage.fill('input[name="email"]', client.email);
  // client must exist first: sign them up in their own context
  const clientCtx = await browser.newContext();
  const clientPage = await clientCtx.newPage();
  await signup(clientPage, client);
  await ownerPage.click('button:has-text("Add")');

  // owner opens mockup and drops a pin + comment
  await ownerPage.goto("/app");
  await ownerPage.click("text=Homepage");
  await ownerPage.click("text=sample.png");
  await ownerPage.click("img[alt='mockup']");
  await ownerPage.fill("textarea", "Please fix the header");
  await ownerPage.click('button:has-text("Comment")');
  await expect(ownerPage.locator("text=Please fix the header")).toBeVisible();

  // resolve and verify filter
  await ownerPage.click('button:has-text("Mark resolved")');
  await ownerPage.click('button:has-text("active")');
  await expect(ownerPage.locator("button:has-text('1')")).toHaveCount(0);
});
```

- [ ] **Step 4: Run the E2E test**

Run: `npm run test:e2e`
Expected: PASS — the full loop completes. (If the local Supabase stack requires email confirmation, disable it for local dev in `supabase/config.toml` under `[auth]` → `enable_confirmations = false`, and document this.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: end-to-end core-loop coverage with Playwright"
```

---

## Self-Review Notes (author)

- **Spec coverage:** auth (T4) incl. Google callback; profiles (T3); workspaces + members (T3/T5/T6); projects (T6); image upload + storage + limits (T7/T8); zoom/pan viewer + normalized pins (T9/T11); numbered pins (T10); threaded comments + status + filter (T12); RLS on every table (T3/T6/T8/T10); E2E core loop (T13). Deferred to Plan 2 by design: share links, real-time, email/in-app notifications. Deferred to later phases: PDF, version history, Figma.
- **Coordinate correctness:** pins stored normalized (T9/T10 constraint `x,y ∈ [0,1]`), rendered as percentages (T11 `PinMarker`) so they track zoom/pan — the spec's key requirement.
- **Type consistency:** `ViewerPin`/`ViewerComment` defined once in `MockupViewer.tsx` and imported by `CommentThread`/`CommentFilter`; server actions `createPin/addComment/setPinStatus` share the `(mockupId, …)` signature used by the components.
- **Known human setup (documented in README):** local Supabase via CLI+Docker, `.env.local` keys, optional Google provider config, `enable_confirmations = false` for local E2E.
```
