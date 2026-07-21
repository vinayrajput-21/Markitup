# Figma Prototype Review Surface — Design Spec

**Date:** 2026-07-16
**Status:** Approved (design), implementing

## Summary

Let an agency paste a **Figma prototype link** and review it inside MarkUp. A
Figma mockup carries two representations of the same frame, toggled in the viewer:

- **Browse** — a live `<iframe>` of Figma's prototype embed. Fully interactive:
  animations, video fills, GIFs, and click-through prototype interactions all play.
- **Comment** — a PNG of that frame rendered via the Figma REST API, shown in the
  existing viewer with position-anchored pins, threads, mentions, share, notifications.

Rationale: a cross-origin Figma embed exposes no design-coordinate system, so pins
cannot anchor to it. The Comment/Browse split (the Markup.io model) is the only way
to give clients the true experience **and** keep pixel-accurate feedback.

## Decisions

| Decision | Choice |
| --- | --- |
| Review model | Hybrid: live embed (Browse) + rendered frame with pins (Comment) |
| Auth | One workspace-level Figma **personal access token**, stored encrypted |
| Import unit | One frame per import (the node in the pasted prototype link) |
| Sync | "Re-sync from Figma" re-renders the Comment PNG in place; Browse is always live |
| Out of scope | Multi-screen prototype flows as separate pinnable pages; OAuth; two-way Figma comment sync; live-embed pins |

## Data model

- `mockups` gains nullable columns: `figma_file_key text`, `figma_node_id text`,
  `figma_embed_url text`. Set only when `type = 'figma'`. `file_path` continues to
  hold the rendered Comment-mode PNG, so all existing mockup/pin/comment code works
  unchanged.
- New `workspace_integrations` table:
  `(id, workspace_id unique, figma_token_cipher text, figma_token_iv text,
    connected_by, created_at)`. RLS: only workspace owner/admin may read/write; the
  token is decrypted **server-side only** and never sent to the client.

## Architecture & data flow

**Token storage.** `setFigmaToken(token)` (server action, owner/admin only):
AES-256-GCM encrypt with an app key from `FIGMA_TOKEN_SECRET` (env), store
cipher + iv in `workspace_integrations`. `getFigmaConnection()` returns only
`{ connected: boolean }` (never the token).

**Import.** `importFigmaFrame(projectId, figmaUrl)`:
1. `parseFigmaUrl(url)` → `{ fileKey, nodeId }`. Handles `/proto/`, `/file/`,
   `/design/`; normalizes `node-id=12-34` → `12:34`; errors on a non-Figma URL.
2. Load + decrypt the workspace token.
3. Figma REST: `GET /v1/images/:fileKey?ids=<node>&format=png&scale=2` → PNG URL;
   `GET /v1/files/:fileKey/nodes?ids=<node>` → frame name.
4. Download the PNG, upload to the `mockups` bucket at `<projectId>/<uuid>.png`.
5. Insert a `mockups` row: `type='figma'`, `file_path`, `name` (frame name),
   `figma_file_key`, `figma_node_id`, `figma_embed_url`
   (`https://embed.figma.com/proto/<key>/...?node-id=<node>&embed-host=markitup`).

**Sync.** `resyncFigma(mockupId)` re-runs render + overwrites the storage object at
the same path; pins persist via normalized coords.

**Viewer.** `type='figma'` mockups render a **Comment / Browse** toggle in the top
bar. Comment = existing `MockupViewer` on the PNG. Browse = sandboxed
`<iframe src={figma_embed_url}>` (fullscreen allowed, figma.com only).

## UX

- **Workspace settings** (owner/admin): a "Figma" section to paste/replace/remove
  the personal access token, with a "Connected" indicator. Link to where to create
  the token in Figma.
- **Project**: an "Import from Figma" affordance beside Upload — paste a prototype
  link, we import the frame. Clear error if not connected / bad link / no access.
- **Viewer**: Comment/Browse toggle (only for figma mockups) + a "Re-sync" action
  and a "View in Figma" link.

## Error handling & security

- Missing token → "Connect Figma in workspace settings first."
- Bad URL → "That doesn't look like a Figma link."
- Figma 403 (bad token) / 404 (no access) / null image (node not renderable) →
  specific, friendly messages; never leak the token or raw API errors.
- Token encrypted at rest (AES-256-GCM); `FIGMA_TOKEN_SECRET` required in env.
- Embed iframe restricted to `embed.figma.com`; `sandbox`/`allow` scoped.
- Figma mockups are ordinary `mockups` rows, so existing per-project RLS governs
  who can view/comment; `workspace_integrations` has its own owner/admin RLS.

## Testing

- **Unit:** `parseFigmaUrl` (proto/file/design shapes, `12-34`→`12:34`, rejects
  non-Figma); AES-GCM encrypt→decrypt round-trip; embed-URL builder.
- **Integration:** `importFigmaFrame` against a mocked Figma API (render + name) →
  asserts a `type='figma'` mockup row with the metadata.
- **Manual/live:** with a real workspace token + a real prototype link, verify the
  Comment PNG renders and Browse plays the live prototype.
