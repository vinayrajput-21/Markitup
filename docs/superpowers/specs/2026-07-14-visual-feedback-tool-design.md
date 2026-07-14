# Visual Feedback & Mockup Review Tool — Design Spec

**Date:** 2026-07-14
**Status:** Approved (design), pending implementation plan

## 1. Summary

A multi-tenant visual feedback tool (Markup.io-style). Agencies get a workspace,
invite team members, create projects, upload mockups, and share login-gated review
links. Clients sign in and leave pinned, threaded comments that appear live for
everyone; threads get resolved; participants get notified in-app and by email.

## 2. Confirmed Decisions

| Decision | Choice |
| --- | --- |
| Reviewer auth | **Account required** — everyone signs in; no anonymous/guest commenting |
| File types | Images (v1), multi-page PDF (Phase 2), Figma embeds (Phase 3) |
| Tenancy | **Multi-tenant workspaces** — team members under an agency, clients per-project |
| Real-time | **Yes in v1** — live pins/comments for all viewers |
| Stack | **Next.js + Supabase**, Resend for email, deploy on Vercel |
| Sequencing | **Phased, core-loop first** |

## 3. Scope & Phase Boundaries

### Phase 1 (v1) — the core loop
- Email/password auth + Google OAuth; profiles (name, avatar)
- Workspaces + team members (invite by email, roles)
- Projects under a workspace; invite clients to a project as reviewers
- Upload **image** mockups (PNG/JPG); full-res viewer with zoom/pan + thumbnails
- Per-mockup share links: **public** (any signed-in user with link) vs **restricted** (invited only)
- Pinned, numbered, threaded comments; active/resolved status; All/Active/Resolved filter
- **Real-time** — new pins/comments appear live
- Notifications — in-app bell + email to mockup owner and thread participants

### Phase 2
- Multi-page **PDF** mockups (each page a reviewable canvas; pins anchored per page)
- @mentions; filter by author/date

### Phase 3
- **Version history** (re-upload, keep prior versions accessible)
- **Figma embeds** (staged last — coordinate anchoring over a live embed is the hardest surface)

### Explicitly deferred / YAGNI
- Password-protected links (schema stub only)
- Guest/anonymous commenting (superseded by accounts-for-everyone)
- Billing

## 4. Architecture

**Stack:** Next.js (App Router, React, TypeScript) + Supabase (Postgres, Auth,
Storage, Realtime) + Resend. Deploy on Vercel.

- **Auth** — Supabase Auth (email/password + Google OAuth) via `@supabase/ssr` for
  cookie-based sessions in Server Components and Route Handlers.
- **Data access** — Server Components read directly; mutations via Server Actions /
  Route Handlers. **Row-Level Security (RLS)** is the security backbone: every table
  carries or joins to a `workspace_id`, and policies enforce that a user sees only
  rows for workspaces/projects they belong to.
- **Storage** — two Supabase Storage buckets: `mockups` (originals, private, signed
  URLs) and `avatars` (public). Thumbnails via Supabase image transformation.
- **Realtime** — the browser Supabase client subscribes to `pins` and `comments`
  changes filtered by `mockup_id` while a mockup is open.
- **Email** — a server-side notification dispatcher (Route Handler) calls Resend when
  a comment is posted, fanning out to the mockup owner + prior thread participants.

### Module boundaries (each independently testable)
- `auth/` — session, sign-in/up, OAuth callback
- `workspaces/` — workspace + member + invite logic
- `projects/` & `mockups/` — CRUD + upload/storage
- `viewer/` — zoom/pan canvas + pin overlay (pure client; coordinate math isolated)
- `comments/` — pin creation, threading, status, realtime subscription
- `notifications/` — in-app feed + email fan-out
- `share/` — link generation + visibility gating

## 5. Data Model

```
profiles                (mirrors Supabase auth.users)
  id (=auth uid), name, email, avatar_url, created_at

workspaces
  id, name, owner_id -> profiles, created_at

workspace_members       -- agency team (uploaders)
  id, workspace_id, user_id -> profiles, role [owner|admin|member], created_at

projects
  id, workspace_id, name, created_by, created_at

project_members         -- clients invited as reviewers live HERE, not on the workspace
  id, project_id, user_id -> profiles, role [reviewer|editor], created_at

invitations             -- pending invites (team or client) before signup/accept
  id, workspace_id, project_id (nullable), email, role, token, invited_by,
  accepted_at, created_at

mockups
  id, project_id, name, type [image|pdf|figma], file_path, page_count (default 1),
  created_by, created_at
  -- v1: file lives inline. Phase 3 extracts mockup_versions and points
  --     current_version_id here.

pins
  id, mockup_id, page (int, default 0), x (float 0..1), y (float 0..1),
  number (int, sequential per mockup), status [active|resolved],
  created_by, created_at

comments
  id, pin_id, author_id, body, parent_comment_id (nullable, for replies),
  created_at, updated_at

notifications
  id, user_id, type [comment|reply|mention|resolved], pin_id, comment_id,
  actor_id, read_at, created_at

share_links
  id, mockup_id, token (unique), visibility [public|restricted],
  password_hash (nullable, Phase 3+), created_by, created_at
```

### Refinements from the original sketch
1. **`status` moved from comments -> pins.** A pin *is* a thread; resolving is a
   thread-level action.
2. **Pins use normalized `x`/`y` (0-1), plus `page`.** Storing fractions of the
   image's natural size (not pixels) keeps pins glued to the right spot across zoom,
   pan, and screen size. `page` lets the same table serve PDFs in Phase 2 with no
   schema change.
3. **Clients attach at the project level (`project_members`), not the workspace.**
   Agency team = workspace members; a client is only a reviewer on the project(s)
   they're invited to.

## 6. Key Flows

**Auth & invites.** Owner creates a workspace on signup. Inviting a teammate or client
sends a Resend email with a tokenized `invitations` link. Recipient signs up / logs in
(email-password or Google) -> token redeemed -> they become a `workspace_member` (team)
or `project_member` reviewer (client). Google OAuth returns through a Supabase callback
route that upserts their `profile`.

**Share link + access gating.** Each mockup can mint a `share_links` token. Opening
`/s/<token>` **always** requires login. Then: `restricted` -> access only if you're a
project member; `public` -> any signed-in user with the link is auto-granted reviewer
access to that project on first visit. RLS enforces both server-side, so a guessed URL
leaks nothing.

**Pinning & coordinate anchoring.** The viewer renders the full-res image inside a
zoom/pan container. Click -> convert click point to normalized `(x, y)` against the
image's natural dimensions -> create a pin with the next sequential `number`. Pins
render as an overlay positioned by `x*width, y*height`, tracking the image through
zoom/pan/resize. Clicking a pin opens its thread; replies set `parent_comment_id`.

**Real-time.** On mockup open, the browser subscribes to Supabase Realtime for `pins`
and `comments` where `mockup_id = current`. Inserts/updates/deletes patch local state
live — new pins, replies, and resolve/reopen appear without refresh for everyone.

**Notifications.** Posting a comment triggers a server-side dispatcher that (a) inserts
`notifications` rows for the mockup owner + all prior thread participants except the
actor (surfaced live in the in-app bell), and (b) sends them a Resend email. Resolving
a thread notifies the same set.

## 7. Non-Functional Requirements

- **Mobile-responsive review** — touch pinch-zoom/pan, tap-to-pin, bottom-sheet thread
  panel on small screens.
- **Fast image loading** — thumbnails in lists; full-res via signed URL only on open;
  lazy-load.
- **Upload limits** — per-file size cap (25 MB v1) enforced client + server, with clear
  inline error; MIME validated against mockup `type`.
- **Security** — RLS on every table; originals private behind signed URLs;
  invitation/share tokens are unguessable random values.

## 8. Testing Strategy

- **Unit** — normalized-coordinate conversion, sequential pin numbering, notification
  fan-out (who gets notified), invite-token redemption.
- **Integration** — RLS policies (workspace A cannot read workspace B), upload/storage,
  share-link gating (public vs restricted), notification dispatcher.
- **E2E (Playwright)** — full core loop: sign up -> create workspace -> upload image ->
  share -> second user signs in via link -> drops a pin -> comments -> first user sees
  it live -> resolves -> filter updates.
