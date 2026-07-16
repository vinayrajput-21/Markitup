# Design: Comments v2 — Attribution Fix, Folder Removal, New Badge, Rich Comments

Date: 2026-07-16
Status: Approved (design), delivered in two groups (A then B)

## Overview

**Group A (quick):**
- **A1.** Fix comment author showing "Unknown" for project-only members (RLS gap).
- **A2.** Remove the folder concept from the dashboard, keeping project-card counts and Archive.
- **A3.** Show a "New" badge on mockups the current user hasn't opened yet.

**Group B (rich comments):**
- **B1.** Rich text (bold/italic/underline/bullets/link) in the comment popup + reply box, stored as sanitized HTML.
- **B2.** Attachments (paste or add images/PDFs) on comments, uploaded direct to Supabase Storage.

## Confirmed root cause of "Unknown"

`profiles` RLS (`0001`) has `read co-member profiles`, which only permits reading a profile when the viewer and the target **share a workspace**. A client invited to a single project via the Share dialog lands in `project_members`, not `workspace_members`. Verified against the live DB: **1 such project-only member exists.** So the comments join `profiles(name, email)` returns null for that user → `name || emailLocalPart(email) || "Unknown"` resolves to "Unknown", and they also don't appear in @mentions.

## Decisions (from brainstorming)

- Remove folders; **keep** project-card counts and Archive. Leave the `projects.folder_id`/`archived_at` columns in place (dropping is riskier and gains nothing) — `folder_id` simply becomes unused.
- Rich text is a **lightweight in-house editor** (contentEditable + toolbar). HTML is sanitized **server-side** with the `sanitize-html` dependency (allow-list only) — not a hand-rolled sanitizer.
- Attachments go to a **new private Storage bucket** + a `comment_attachments` table; uploaded direct-to-Storage via signed URL (bypassing Vercel's function body limit, same pattern as mockups).
- "New" badge = **not yet viewed by you**, reusing the `mockup_views` table (Phase 3).

## Out of scope

- Dropping the `folder_id`/`archived_at` columns.
- Rich text beyond b/i/u/lists/links (no tables, images-in-text, headings).
- Attachment types beyond images + PDF.
- Editing/formatting existing plain-text comments (old comments render as-is; they are valid HTML-escaped text under the new renderer).

---

## Group A

### A1 — Co-project-member profile read (migration)

`0010_project_member_profiles.sql`:
```sql
-- Let you read the profile of anyone who shares a PROJECT with you (not just a
-- workspace). Fixes comment authors showing "Unknown" and missing @mentions for
-- clients invited to a single project. can_see_project is SECURITY DEFINER so it
-- does not recurse into profiles' RLS.
create policy "read co-project-member profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.project_members pm
      where pm.user_id = profiles.id and public.can_see_project(pm.project_id)
    )
  );
```
No app-code change is required — the existing `profiles(name, email)` joins in the mockup page (comments + members map) start returning the row, so real names appear and the client shows up in @mentions. Applied at deploy. A `scripts/*-check.mjs`-style proof is optional; the policy reuses the proven `can_see_project`.

### A2 — Remove folders (keep counts + archive)

- `app/app/page.tsx`: drop the "Folders" section, the `NewFolderButton`, and the folder query; render only the project grid (folder-less filter removed — show all non-archived projects) with counts, `NewProject`, `Invite`, `NotificationBell`, `ProfileMenu`. Keep `ProjectCard` + the (now archive-only) card menu.
- Delete `app/app/folders/[folderId]/page.tsx` and `components/app/NewFolderButton.tsx` (+ its test).
- `components/app/ProjectCardMenu.tsx`: reduce to a single **Archive** action (remove the folders prop + move-to-folder options). Update its test.
- `app/app/folders-actions.ts`: remove `createFolder`/`renameFolder`/`deleteFolder`/`moveProjectToFolder`; **keep** `archiveProject`/`unarchiveProject`. Update `folders-actions.test.ts` accordingly. (File may be renamed to `archive-actions.ts`; keeping the name is fine to minimize churn.)
- Sidebar nav (Dashboard · Team · Archive) is unchanged.

### A3 — "New" badge on unviewed mockups

- `app/app/projects/[projectId]/page.tsx`: after loading the mockups + the current user, fetch the user's `mockup_views` rows for these mockup ids (`select mockup_id from mockup_views where user_id = <me> and mockup_id in (...)`), build a `viewedIds` Set, and render a small **New** badge on the thumbnail of any mockup NOT in the set. Purely additive to the existing card.

---

## Group B

### B1 — Rich text comments

- New client component `components/viewer/RichCommentInput.tsx`: a contentEditable surface + a compact toolbar (Bold, Italic, Underline, Bullet list, Link). Emits its current HTML via `onChange`/on submit. Uses `document.execCommand` for formatting (works cross-browser today) and a small controlled wrapper. Placeholder + Cmd/Ctrl+Enter to submit, matching the current composer UX. @mention autocomplete continues to work over the text.
- `PinComposer.tsx` and `CommentThread.tsx` use `RichCommentInput` instead of the plain `<textarea>`; they now submit an HTML `body`.
- Storage/sanitization: `addComment` (server action) sanitizes the incoming `body` with `sanitize-html` allowing only `b, strong, i, em, u, ul, ol, li, a, br, p, span` and `a[href]` (http/https/mailto only), stripping everything else. The sanitized HTML is stored in `comments.body` (existing text column — HTML is just text).
- Rendering: `CommentRow` renders the stored (already-sanitized) HTML via `dangerouslySetInnerHTML`. Because sanitization happened at write time, render is safe. Old plain-text comments render unchanged (they contain no tags). @mention highlighting is applied by a light post-process that wraps known `@name` spans, or is simplified to plain highlighted text — mentions remain functional either way.
- A `lib/sanitize.ts` wrapper centralizes the allow-list config and is unit-tested (strips `<script>`, `onerror`, `javascript:` hrefs; keeps `<b>`/`<a href>`).

### B2 — Comment attachments

- Migration `0011_comment_attachments.sql`: table `comment_attachments (id, comment_id → comments cascade, file_path, type text check in ('image','pdf'), name text, created_at)` + RLS (select where you can see the comment's mockup via `can_see_pin`; insert with check same + you are the comment author is not required — visibility gate suffices) + a new private Storage bucket `comment-files` with read/write policies gated on `can_see_project` of the path's project folder (mirroring the `mockups` bucket).
- Upload (client): in `RichCommentInput`, a paste handler (images) + an "attach" button (`image/*,application/pdf`). Each file uploads **direct to Storage** via a signed upload URL from a new `createAttachmentUploadUrl(projectId, fileType)` server action (same signed-URL pattern as mockup uploads), then is held as a pending attachment `{ path, type, name }`.
- Save: the comment submit passes the pending attachments to `addComment`, which (after inserting the comment) inserts `comment_attachments` rows. Best-effort per attachment does not apply — an attachment failure should surface, but must not lose the comment; attachments are inserted after the comment succeeds and errors are reported without rolling back the comment.
- Render: `CommentRow` shows, under the body, image previews (signed URLs, click to open) and PDF links (filename + open). Signed URLs are produced server-side in the mockup page's comment mapping (batch `createSignedUrls`).

## Cross-cutting

- New tables get RLS; the new bucket mirrors the proven `mockups` bucket policies.
- Sanitization is the security boundary for rich text; attachments are validated (type allow-list) and stored under the project's folder so bucket RLS enforces tenant isolation.
- Existing tests stay green; new behavior is tested (sanitizer unit tests, action tests, component tests). Migrations `0010`/`0011` apply at deploy.

## Delivery

Group A first (one spec section → plan → execute → optional deploy), then Group B (plan → execute → deploy). Each group is independently shippable.
