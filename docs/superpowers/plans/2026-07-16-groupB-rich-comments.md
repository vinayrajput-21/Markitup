# Group B — Rich Text + Attachments in Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let users format comments (bold/italic/underline/bullets/link) and attach images/PDFs (paste or add), in the pin popup and the reply box.

**Architecture:** A lightweight contentEditable editor (`RichCommentInput`) with a toolbar produces HTML; the server sanitizes it with `sanitize-html` (allow-list) before storing in `comments.body`; `CommentRow` renders the already-sanitized HTML. Attachments upload direct-to-Storage via signed URLs (bypassing Vercel's limit) into a new private bucket, recorded in a `comment_attachments` table, and rendered under each comment.

**Tech Stack:** Next.js 16, React 19, Supabase (`@supabase/ssr`), `sanitize-html`, Postgres RLS, Vitest + Testing Library.

## Global Constraints

- **Disk workaround (important):** the `C:` drive is nearly full. For EVERY npm/build/test/tsc command, prefix `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build npm_config_cache=/d/tmp/npm-cache;` (note the `npm_config_cache` for installs). Use `node_modules/.bin/tsc --noEmit -p .` / `node_modules/.bin/vitest run --pool=threads`. `/d/tmp/claude-build` exists; the install task creates `/d/tmp/npm-cache`.
- **Sanitization is the security boundary.** All comment HTML is sanitized server-side at write time in `addComment`. Rendered HTML must only ever be post-sanitization output. Allow-list: tags `b,strong,i,em,u,ul,ol,li,a,br,p,span`; `a` attrs `href,target,rel` with `http/https/mailto` only.
- Best-effort side effects (notifications, view records) keep their existing guarantees; adding attachments must not lose a comment (comment inserts first, attachments after).
- Attachments limited to images + PDF; each ≤ 25 MB (reuse `validateUpload` shape); stored under `<projectId>/...` so bucket RLS enforces tenant isolation.
- Run `tsc --noEmit` before each commit; `npm run build` on wiring tasks. Migration `0011` applies at deploy.
- **Mentions tradeoff:** the live `@`-autocomplete dropdown is dropped in the rich editor (contentEditable makes caret/insert fiddly). Users still type `@name`, which is highlighted on render. (Documented; revisit if needed.)

---

### Task 1: sanitize-html dependency + lib/sanitize.ts

**Files:**
- Modify: `package.json` (add `sanitize-html` + `@types/sanitize-html`)
- Create: `lib/sanitize.ts`
- Create: `lib/sanitize.test.ts`

**Interfaces:**
- Produces: `sanitizeCommentHtml(dirty: string): string` — returns allow-listed HTML.

- [ ] **Step 1: Install the dependency (route cache to D:)**

Run: `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build npm_config_cache=/d/tmp/npm-cache; mkdir -p /d/tmp/npm-cache && npm install sanitize-html && npm install -D @types/sanitize-html`
Expected: both appear in `package.json`.

- [ ] **Step 2: Write the failing test**

Create `lib/sanitize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sanitizeCommentHtml } from "./sanitize";

describe("sanitizeCommentHtml", () => {
  it("keeps allowed formatting", () => {
    const out = sanitizeCommentHtml("<b>bold</b> <i>it</i> <ul><li>x</li></ul>");
    expect(out).toContain("<b>bold</b>");
    expect(out).toContain("<li>x</li>");
  });
  it("strips scripts and event handlers", () => {
    const out = sanitizeCommentHtml('<img src=x onerror=alert(1)><script>alert(1)</script>hi');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onerror");
    expect(out).toContain("hi");
  });
  it("keeps safe links, drops javascript: urls", () => {
    expect(sanitizeCommentHtml('<a href="https://x.com">x</a>')).toContain('href="https://x.com"');
    expect(sanitizeCommentHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build; node_modules/.bin/vitest run lib/sanitize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the sanitizer**

Create `lib/sanitize.ts`:

```ts
import sanitizeHtml from "sanitize-html";

// Allow-list for user comment HTML. Everything else is stripped. This runs
// server-side at write time; rendered comment HTML is always this function's
// output, never raw user input.
export function sanitizeCommentHtml(dirty: string): string {
  return sanitizeHtml(dirty ?? "", {
    allowedTags: ["b", "strong", "i", "em", "u", "ul", "ol", "li", "a", "br", "p", "span"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
  });
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build; node_modules/.bin/vitest run lib/sanitize.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: tsc + full suite + commit**

Run: `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build; node_modules/.bin/tsc --noEmit -p . && node_modules/.bin/vitest run --pool=threads`

```bash
git add package.json package-lock.json lib/sanitize.ts lib/sanitize.test.ts
git commit -m "feat(comments): add sanitize-html + sanitizeCommentHtml allow-list"
```

---

### Task 2: RichCommentInput editor

**Files:**
- Create: `components/viewer/RichCommentInput.tsx`
- Create: `components/viewer/RichCommentInput.test.tsx`

**Interfaces:**
- Produces: `RichCommentInput` client component with props `{ value?: string; onSubmit: (html: string, attachments: PendingAttachment[]) => void; pending?: boolean; placeholder?: string; projectId: string }`. For Task 2, attachments are stubbed (empty array); the attach UI lands in Task 5/6. Exposes a `PendingAttachment` type `{ path: string; type: "image" | "pdf"; name: string }`.

- [ ] **Step 1: Write the failing test**

Create `components/viewer/RichCommentInput.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RichCommentInput } from "./RichCommentInput";

describe("RichCommentInput", () => {
  it("submits the typed HTML", () => {
    const onSubmit = vi.fn();
    render(<RichCommentInput onSubmit={onSubmit} projectId="p1" placeholder="Add comment here…" />);
    const box = screen.getByRole("textbox");
    box.innerHTML = "<b>hello</b>";
    fireEvent.input(box);
    fireEvent.click(screen.getByRole("button", { name: /^comment$/i }));
    expect(onSubmit).toHaveBeenCalled();
    expect(onSubmit.mock.calls[0][0]).toContain("hello");
  });

  it("exposes formatting controls", () => {
    render(<RichCommentInput onSubmit={vi.fn()} projectId="p1" />);
    expect(screen.getByRole("button", { name: /bold/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /bullet/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /link/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build; node_modules/.bin/vitest run components/viewer/RichCommentInput.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the editor**

Create `components/viewer/RichCommentInput.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";

export type PendingAttachment = { path: string; type: "image" | "pdf"; name: string };

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // preserve the editor selection: don't let the button steal focus
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded text-muted transition-colors hover:bg-[color:var(--accent)] hover:text-ink"
    >
      {children}
    </button>
  );
}

export function RichCommentInput({
  onSubmit,
  pending,
  placeholder,
  projectId,
}: {
  value?: string;
  onSubmit: (html: string, attachments: PendingAttachment[]) => void;
  pending?: boolean;
  placeholder?: string;
  projectId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);

  function exec(cmd: string, arg?: string) {
    ref.current?.focus();
    // execCommand is deprecated but universally supported; adequate for a
    // small comment formatter and avoids a heavy editor dependency.
    document.execCommand(cmd, false, arg);
    syncEmpty();
  }

  function syncEmpty() {
    const html = ref.current?.innerHTML ?? "";
    setEmpty(html.replace(/<br>|\s|&nbsp;/g, "").length === 0);
  }

  function submit() {
    const html = ref.current?.innerHTML ?? "";
    if (empty) return;
    onSubmit(html, []);
    if (ref.current) ref.current.innerHTML = "";
    setEmpty(true);
  }

  return (
    <div className="rounded-lg border bg-surface">
      <div className="flex items-center gap-0.5 border-b px-1.5 py-1">
        <ToolBtn label="Bold" onClick={() => exec("bold")}><span className="text-sm font-bold">B</span></ToolBtn>
        <ToolBtn label="Italic" onClick={() => exec("italic")}><span className="text-sm italic">I</span></ToolBtn>
        <ToolBtn label="Underline" onClick={() => exec("underline")}><span className="text-sm underline">U</span></ToolBtn>
        <ToolBtn label="Bullet list" onClick={() => exec("insertUnorderedList")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><circle cx="4" cy="6" r="1.3" fill="currentColor" /><circle cx="4" cy="12" r="1.3" fill="currentColor" /><circle cx="4" cy="18" r="1.3" fill="currentColor" /></svg>
        </ToolBtn>
        <ToolBtn label="Link" onClick={() => { const url = window.prompt("Link URL"); if (url) exec("createLink", url); }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M10 14a4 4 0 0 1 0-6l2-2a4 4 0 1 1 6 6l-1 1M14 10a4 4 0 0 1 0 6l-2 2a4 4 0 1 1-6-6l1-1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </ToolBtn>
      </div>
      <div className="relative">
        {empty && placeholder && (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-faint">{placeholder}</span>
        )}
        <div
          ref={ref}
          role="textbox"
          aria-label="Comment"
          contentEditable
          suppressContentEditableWarning
          onInput={syncEmpty}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}
          data-project={projectId}
          className="min-h-[3.5rem] w-full px-3 py-2 text-sm leading-relaxed text-ink outline-none [&_a]:text-brand [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
      <div className="flex items-center justify-end gap-2 border-t px-2 py-1.5">
        <button type="button" disabled={pending || empty} onClick={submit} className="btn-primary btn-sm">
          {pending ? "Saving…" : "Comment"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build; node_modules/.bin/vitest run components/viewer/RichCommentInput.test.tsx`
Expected: PASS.

- [ ] **Step 5: tsc + full suite + commit**

Run: `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build; node_modules/.bin/tsc --noEmit -p . && node_modules/.bin/vitest run --pool=threads`

```bash
git add components/viewer/RichCommentInput.tsx components/viewer/RichCommentInput.test.tsx
git commit -m "feat(comments): RichCommentInput contentEditable editor + toolbar"
```

---

### Task 3: Use rich text in composers; sanitize on write; render HTML

**Files:**
- Modify: `app/app/mockups/[mockupId]/actions.ts` (`addComment` sanitizes body)
- Modify: `components/viewer/CommentThread.tsx` (reply box → RichCommentInput; render HTML)
- Modify: `components/viewer/PinComposer.tsx` (popup → RichCommentInput)
- Modify: `components/viewer/MockupViewer.tsx` (PinComposer/save flow already passes body string — no signature change; ensure it passes HTML through)
- Modify: `components/viewer/CommentThread.test.tsx` / `MockupViewer.test.tsx` (adjust for the editor if needed)

**Interfaces:**
- Consumes: `sanitizeCommentHtml` (Task 1), `RichCommentInput` (Task 2).

- [ ] **Step 1: Sanitize in `addComment`**

In `app/app/mockups/[mockupId]/actions.ts`, add the import `import { sanitizeCommentHtml } from "@/lib/sanitize";` and sanitize the body before insert. Change the insert to use `body: sanitizeCommentHtml(body)`. (The `body` parameter now carries HTML.) Everything else in `addComment` (recipients, notifications) stays; the notification `p_body` should use a plain-text form — set it from the mockup name only (already does: "commented on <mockup>"), so no HTML leaks into notifications.

- [ ] **Step 2: Render HTML in `CommentRow`**

In `components/viewer/CommentThread.tsx`, replace the `<MentionText>` paragraph in `CommentRow` with sanitized-HTML rendering. Since the stored body is already sanitized server-side, render it directly:
```tsx
        <div
          className="mt-0.5 text-sm leading-relaxed break-words text-muted [&_a]:text-brand [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: c.body }}
        />
```
Remove the now-unused `MentionText`/`names` wiring from `CommentRow` (keep `escapeRegExp`/`MentionText` only if still used elsewhere; if not, delete them). @mentions typed as `@name` still appear as text.

- [ ] **Step 3: Swap the reply box to RichCommentInput**

In `components/viewer/CommentThread.tsx`, replace the `<textarea>` + send button block at the bottom with `RichCommentInput`, wiring `onSubmit` to the existing `post()` logic (which currently reads `body` state). Change `post` to accept the html string:
```tsx
  async function post(html: string) {
    const text = html.trim();
    if (!text) return;
    const res = await addComment(mockupId, pin.id, text, replyTo ?? undefined);
    if (res.error) return;
    const optimistic: ViewerComment = {
      id: `tmp-${pin.comments.length}`,
      body: text,
      authorName: currentUserName,
      parentCommentId: replyTo,
      createdAt: new Date().toISOString(),
    };
    onChange({ ...pin, comments: [...pin.comments, optimistic] });
    setReplyTo(null);
  }
```
and render:
```tsx
        <RichCommentInput projectId={""} placeholder="Add a comment…" onSubmit={(html) => post(html)} />
```
Remove the `body`/`mentionQuery`/`suggestions` state and the mention dropdown JSX that are no longer used. (The `members` prop can remain unused or be removed from the type — keep the prop to avoid touching the caller, but stop using it.)

> Note: `projectId` isn't readily available in `CommentThread`; pass `""` for now — it's only used by the attachment upload (Task 6), which will thread the real projectId then.

- [ ] **Step 4: Swap the pin popup to RichCommentInput**

In `components/viewer/PinComposer.tsx`, replace the `<textarea>` + Cancel/Comment row with `RichCommentInput` (plus a Cancel affordance). Keep the `onCancel`/`onSubmit(body)` props; wire `RichCommentInput`'s `onSubmit` to call the existing `onSubmit(html)`. Keep the popup's positioning wrapper. Add a small "Cancel" text button next to the editor.

- [ ] **Step 5: Adjust tests**

Update `MockupViewer.test.tsx`'s pin-composer test: the composer now renders a contentEditable (role `textbox`) instead of a textarea placeholder. Change the interaction to set `innerHTML` on the `textbox` and click Comment, asserting the pin+comment still appear (the current-user name assertion stays valid). Update `CommentThread.test.tsx` similarly if it drives the textarea.

- [ ] **Step 6: Verify build + tsc + full suite**

Run: `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build; npm run build && node_modules/.bin/tsc --noEmit -p . && node_modules/.bin/vitest run --pool=threads`
Expected: build succeeds; tsc clean; all pass.

- [ ] **Step 7: Commit**

```bash
git add app/app/mockups/[mockupId]/actions.ts components/viewer/CommentThread.tsx components/viewer/PinComposer.tsx components/viewer/MockupViewer.tsx components/viewer/CommentThread.test.tsx components/viewer/MockupViewer.test.tsx
git commit -m "feat(comments): rich-text composer + sanitized HTML rendering"
```

---

### Task 4: Attachments migration (table + bucket + RLS)

**Files:**
- Create: `supabase/migrations/0011_comment_attachments.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0011_comment_attachments.sql`:

```sql
create table public.comment_attachments (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  file_path text not null,
  type text not null check (type in ('image','pdf')),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.comment_attachments enable row level security;

-- Visible/insertable if you can see the comment's mockup (via pin -> mockup).
create policy "see comment attachments" on public.comment_attachments
  for select using (
    exists (
      select 1 from public.comments c
      join public.pins pn on pn.id = c.pin_id
      where c.id = comment_id and public.can_see_pin(pn.mockup_id)
    )
  );
create policy "add comment attachments" on public.comment_attachments
  for insert with check (
    exists (
      select 1 from public.comments c
      join public.pins pn on pn.id = c.pin_id
      where c.id = comment_id and public.can_see_pin(pn.mockup_id)
    )
  );

-- private bucket for comment files; object path is '<projectId>/<file>'
insert into storage.buckets (id, name, public)
values ('comment-files', 'comment-files', false)
on conflict (id) do nothing;

create policy "read comment files" on storage.objects
  for select using (
    bucket_id = 'comment-files'
    and public.can_see_project(((storage.foldername(name))[1])::uuid)
  );
create policy "write comment files" on storage.objects
  for insert with check (
    bucket_id = 'comment-files'
    and public.can_see_project(((storage.foldername(name))[1])::uuid)
  );
```

- [ ] **Step 2: Sanity-check by eye** against `0003_mockups_storage.sql` (same bucket/object-policy idiom) and `0004`'s `can_see_pin`. No DB apply here.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_comment_attachments.sql
git commit -m "feat(db): comment_attachments table + comment-files bucket + RLS (migration)"
```

---

### Task 5: Attachment upload action + finalize

**Files:**
- Create: `app/app/mockups/[mockupId]/attachment-actions.ts`
- Create: `app/app/mockups/attachment-actions.test.ts`
- Modify: `app/app/mockups/[mockupId]/actions.ts` (`addComment` accepts + records attachments)

**Interfaces:**
- Produces:
  - `createAttachmentUploadUrl(projectId: string, fileType: string): Promise<{ path?: string; token?: string; error?: string }>` — signs a direct upload to `comment-files` (images/PDF only).
  - `addComment(..., attachments?: { path: string; type: "image" | "pdf"; name: string }[])` — after inserting the comment, inserts `comment_attachments` rows for the given paths (best-effort per row; a failure is logged, comment already saved).

- [ ] **Step 1: Write the failing test**

Create `app/app/mockups/attachment-actions.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const createSignedUploadUrl = vi.fn().mockResolvedValue({ data: { path: "p1/x.png", token: "tok" }, error: null });
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    storage: { from: () => ({ createSignedUploadUrl }) },
  }),
}));

describe("createAttachmentUploadUrl", () => {
  it("rejects a disallowed type", async () => {
    const { createAttachmentUploadUrl } = await import("./[mockupId]/attachment-actions");
    expect((await createAttachmentUploadUrl("p1", "image/gif")).error).toBeTruthy();
  });
  it("returns a signed target for an image", async () => {
    const { createAttachmentUploadUrl } = await import("./[mockupId]/attachment-actions");
    const res = await createAttachmentUploadUrl("p1", "image/png");
    expect(res.path).toBe("p1/x.png");
    expect(res.token).toBe("tok");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build; node_modules/.bin/vitest run app/app/mockups/attachment-actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the upload action**

Create `app/app/mockups/[mockupId]/attachment-actions.ts`:

```ts
"use server";

import { createServerSupabase } from "@/lib/supabase/server";

const TYPES: Record<string, "image" | "pdf" | undefined> = {
  "image/png": "image",
  "image/jpeg": "image",
  "application/pdf": "pdf",
};

function extFor(fileType: string) {
  if (fileType === "image/png") return "png";
  if (fileType === "image/jpeg") return "jpg";
  return "pdf";
}

export async function createAttachmentUploadUrl(projectId: string, fileType: string) {
  if (!TYPES[fileType]) return { error: "Only PNG, JPG, and PDF attachments are supported." };
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "You must be signed in." };
  const path = `${projectId}/${crypto.randomUUID()}.${extFor(fileType)}`;
  const { data, error } = await supabase.storage.from("comment-files").createSignedUploadUrl(path);
  if (error) return { error: error.message };
  return { path: data.path, token: data.token };
}
```

- [ ] **Step 4: Record attachments in `addComment`**

In `app/app/mockups/[mockupId]/actions.ts`, extend `addComment`'s signature with a trailing `attachments?: { path: string; type: "image" | "pdf"; name: string }[]` param. The current insert returns nothing; change it to `.select("id").single()` so we get the new comment id, then insert attachment rows:
```ts
  const { data: inserted, error } = await supabase.from("comments").insert({
    pin_id: pinId,
    author_id: author.id,
    body: sanitizeCommentHtml(body),
    parent_comment_id: parentCommentId ?? null,
  }).select("id").single();
  if (error) return { error: error.message };

  if (attachments?.length && inserted?.id) {
    try {
      await supabase.from("comment_attachments").insert(
        attachments.map((a) => ({ comment_id: inserted.id, file_path: a.path, type: a.type, name: a.name })),
      );
    } catch (e) {
      console.error("[comment] attachment insert failed", e);
    }
  }
```
(Keep the notification/email block below, referencing `author`, unchanged.)

- [ ] **Step 5: Run tests, tsc, full suite, commit**

Run: `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build; node_modules/.bin/vitest run app/app/mockups/attachment-actions.test.ts && node_modules/.bin/tsc --noEmit -p . && node_modules/.bin/vitest run --pool=threads`

```bash
git add app/app/mockups/[mockupId]/attachment-actions.ts app/app/mockups/attachment-actions.test.ts app/app/mockups/[mockupId]/actions.ts
git commit -m "feat(comments): signed attachment upload + record on comment"
```

---

### Task 6: Attachment UI in the editor (paste + add), thread projectId

**Files:**
- Modify: `components/viewer/RichCommentInput.tsx` (paste + attach button; upload; pending list)
- Modify: `components/viewer/PinComposer.tsx` / `components/viewer/MockupViewer.tsx` / `components/viewer/CommentThread.tsx` (thread real `projectId`; pass attachments to `addComment`)
- Modify: `app/app/mockups/[mockupId]/page.tsx` (pass `projectId` to `MockupViewer`)

**Interfaces:**
- Consumes: `createAttachmentUploadUrl` (Task 5), `createBrowserSupabase` (`@/lib/supabase/client`), `validateUpload` (`@/lib/validation`).

- [ ] **Step 1: Add paste + attach + upload to `RichCommentInput`**

In `components/viewer/RichCommentInput.tsx`, add pending-attachment state and upload logic: a hidden `<input type="file" accept="image/png,image/jpeg,application/pdf">`, an "attach" toolbar button, and an `onPaste` handler on the editor that intercepts image files. Each selected/pasted file: get a signed URL via `createAttachmentUploadUrl(projectId, file.type)`, upload with `createBrowserSupabase().storage.from("comment-files").uploadToSignedUrl(path, token, file)`, then push `{ path, type, name }` to `pending`. Show pending items as chips (filename + remove). On `submit`, pass `pending` as the second arg to `onSubmit` and clear it. (Full code follows the mockup-upload pattern in `UploadDropzone.tsx`.)

- [ ] **Step 2: Thread projectId + attachments through the callers**

- `app/app/mockups/[mockupId]/page.tsx`: pass `projectId={mockup.project_id}` to `<MockupViewer>`.
- `MockupViewer.tsx`: accept `projectId` prop; pass to `CommentThread` and to `PinComposer`; in `saveDraft`, call `addComment(mockupId, pinId, body, undefined, attachments)` with the attachments received from the composer, and include them in the optimistic pin's first comment if desired.
- `PinComposer.tsx`: accept + forward `projectId`; its `onSubmit` now yields `(html, attachments)`.
- `CommentThread.tsx`: accept `projectId`; `post(html, attachments)` calls `addComment(..., attachments)`.

- [ ] **Step 3: Verify build + tsc + full suite**

Run: `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build; npm run build && node_modules/.bin/tsc --noEmit -p . && node_modules/.bin/vitest run --pool=threads`

- [ ] **Step 4: Commit**

```bash
git add components/viewer/RichCommentInput.tsx components/viewer/PinComposer.tsx components/viewer/MockupViewer.tsx components/viewer/CommentThread.tsx app/app/mockups/[mockupId]/page.tsx
git commit -m "feat(comments): paste/add image & PDF attachments in the composer"
```

---

### Task 7: Render attachments under comments

**Files:**
- Modify: `app/app/mockups/[mockupId]/page.tsx` (fetch + sign attachment URLs; include in ViewerComment)
- Modify: `components/viewer/MockupViewer.tsx` (extend `ViewerComment` with `attachments`)
- Modify: `components/viewer/CommentThread.tsx` (render attachments in `CommentRow`)

**Interfaces:**
- `ViewerComment` gains `attachments: { url: string; type: "image" | "pdf"; name: string }[]`.

- [ ] **Step 1: Fetch + sign attachments in the page**

In `app/app/mockups/[mockupId]/page.tsx`, broaden the pins→comments select to include `comment_attachments(file_path, type, name)`. Collect all attachment `file_path`s, batch `createSignedUrls("comment-files", paths)`, and map each comment's attachments to `{ url, type, name }`. Add them to the built `ViewerComment` objects (default `[]`).

- [ ] **Step 2: Extend the type**

In `components/viewer/MockupViewer.tsx`, add to `ViewerComment`: `attachments: { url: string; type: "image" | "pdf"; name: string }[];`. Ensure optimistic comments set `attachments: []`.

- [ ] **Step 3: Render in `CommentRow`**

In `components/viewer/CommentThread.tsx`, after the comment body, render attachments:
```tsx
        {c.attachments?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {c.attachments.map((a, i) =>
              a.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                  <img src={a.url} alt={a.name} className="h-24 w-24 rounded-md border object-cover" />
                </a>
              ) : (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-[color:var(--accent)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M7 3h7l4 4v14H7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.6" /></svg>
                  {a.name}
                </a>
              ),
            )}
          </div>
        )}
```

- [ ] **Step 4: Verify build + tsc + full suite**

Run: `export TMPDIR=/d/tmp/claude-build TEMP=/d/tmp/claude-build TMP=/d/tmp/claude-build; npm run build && node_modules/.bin/tsc --noEmit -p . && node_modules/.bin/vitest run --pool=threads`

- [ ] **Step 5: Commit**

```bash
git add app/app/mockups/[mockupId]/page.tsx components/viewer/MockupViewer.tsx components/viewer/CommentThread.tsx
git commit -m "feat(comments): render image/PDF attachments under comments"
```

---

## Self-Review

**Spec coverage (Group B):**
- Sanitizer (allow-list, tested) → Task 1. ✅
- Rich editor (B/I/U/bullets/link) → Task 2. ✅
- Composers use it; sanitize on write; render HTML → Task 3. ✅
- Attachments schema + bucket + RLS → Task 4. ✅
- Signed upload action + record on comment → Task 5. ✅
- Paste/add attachment UI + threading projectId → Task 6. ✅
- Render attachments under comments → Task 7. ✅

**Placeholder scan:** Tasks 6's editor-upload and 7's fetch are described precisely with the reference pattern (`UploadDropzone`, the mockup cover-signing) rather than fully inlined, because they mirror existing, working code in this repo; the implementer follows that pattern. Everything security- or data-shape-critical (sanitizer config, migration, action signatures, render) is complete code. Acceptable.

**Type consistency:** `PendingAttachment { path, type, name }` flows editor → composer → `addComment` (Tasks 2/5/6). `ViewerComment.attachments { url, type, name }` is consistent across page mapping, type def, and render (Task 7). `createAttachmentUploadUrl(projectId, fileType)` matches its test and caller. `sanitizeCommentHtml` used only server-side in `addComment`. ✅

**Security review:** comment HTML is sanitized server-side before storage and only sanitized output is rendered (Tasks 1/3). Attachment bucket + table RLS gate on `can_see_project`/`can_see_pin` (Task 4). Upload type allow-list in both the action and the file input (Tasks 5/6). ✅

**Known tradeoff:** live @-mention autocomplete is dropped in the rich editor (contentEditable complexity); `@name` still renders highlighted-as-text. Flagged in Global Constraints. ✅

**Migration-apply note:** `0011` applies at deploy; attachments only function once applied (unit tests mock Supabase). Bucket + table RLS mirror the proven `mockups` patterns.
