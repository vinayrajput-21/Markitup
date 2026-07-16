"use client";

import { useState } from "react";
import type { ViewerPin, ViewerComment } from "./MockupViewer";
import { addComment, setPinStatus } from "@/app/app/mockups/[mockupId]/actions";
import { Avatar } from "@/components/app/AppSidebar";
import { timeAgo, formatDateTime } from "@/lib/format";
import { RichCommentInput, type PendingAttachment } from "@/components/viewer/RichCommentInput";

export type Member = { id: string; name: string };

function CommentRow({ c, small = false }: { c: ViewerComment; small?: boolean }) {
  return (
    <div className="flex gap-2.5">
      <Avatar name={c.authorName} email={c.authorName} size={small ? 24 : 30} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-ink">{c.authorName}</span>
          <span className="shrink-0 font-mono text-[0.6875rem] text-faint" title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</span>
        </div>
        <div
          className="mt-0.5 text-sm leading-relaxed break-words text-muted [&_a]:text-brand [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: c.body }}
        />
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
      </div>
    </div>
  );
}

export function CommentThread({
  mockupId,
  projectId,
  pin,
  members,
  currentUserName,
  onChange,
  onBack,
}: {
  mockupId: string;
  projectId: string;
  pin: ViewerPin;
  members: Member[];
  currentUserName: string;
  onChange: (p: ViewerPin) => void;
  onBack?: () => void;
}) {
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const roots = pin.comments.filter((c) => !c.parentCommentId);
  const repliesOf = (id: string) => pin.comments.filter((c) => c.parentCommentId === id);
  const resolved = pin.status === "resolved";

  async function post(html: string, attachments: PendingAttachment[] = []) {
    const text = html.trim();
    if (!text && attachments.length === 0) return;
    const res = attachments.length
      ? await addComment(mockupId, pin.id, text, replyTo ?? undefined, attachments)
      : await addComment(mockupId, pin.id, text, replyTo ?? undefined);
    if (res.error) return;
    const optimistic: ViewerComment = {
      id: `tmp-${pin.comments.length}`,
      // Render only the server-sanitized HTML, never the raw editor input.
      body: res.body ?? "",
      authorName: currentUserName,
      parentCommentId: replyTo,
      createdAt: new Date().toISOString(),
      attachments: [],
    };
    onChange({ ...pin, comments: [...pin.comments, optimistic] });
    setReplyTo(null);
  }

  async function toggleStatus() {
    const next = resolved ? "active" : "resolved";
    const res = await setPinStatus(mockupId, pin.id, next);
    if (res?.error) return;
    onChange({ ...pin, status: next });
  }

  return (
    <div className="flex h-full flex-col">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 border-b px-4 py-2.5 text-xs font-semibold text-muted transition-colors hover:text-brand-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All comments
        </button>
      )}

      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="grid h-6 w-6 place-items-center rounded-full font-mono text-xs font-bold"
            style={{ background: resolved ? "var(--success)" : "var(--primary)", color: resolved ? "#fff" : "var(--primary-foreground)" }}
          >
            {pin.number}
          </span>
          <span className="text-sm font-bold text-ink">Pin {pin.number}</span>
          <span
            className="chip capitalize"
            style={resolved ? { background: "var(--success-soft)", color: "var(--success)" } : { background: "var(--color-brand-soft)", color: "var(--color-brand-ink)" }}
          >
            {pin.status}
          </span>
        </div>
        <button onClick={toggleStatus} className="btn-secondary btn-sm">
          {resolved ? "Reopen" : "Resolve"}
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-2">
        {roots.length === 0 && <p className="pt-2 text-sm text-faint">No comments yet. Start the thread below.</p>}
        {roots.map((c) => (
          <div key={c.id}>
            <CommentRow c={c} />
            <div className="mt-2 ml-3.5 space-y-3 border-l pl-4">
              {repliesOf(c.id).map((r) => (
                <CommentRow key={r.id} c={r} small />
              ))}
              <button
                onClick={() => setReplyTo(c.id)}
                className="text-xs font-semibold text-brand transition-colors hover:text-brand-hover"
              >
                Reply
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="relative border-t p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-md bg-brand-soft px-2.5 py-1.5 text-xs font-medium text-brand-ink">
            Replying to a comment
            <button onClick={() => setReplyTo(null)} className="text-brand-ink/70 hover:text-brand-ink">Cancel</button>
          </div>
        )}

        <RichCommentInput projectId={projectId} placeholder="Add a comment…" onSubmit={(html, attachments) => post(html, attachments)} />
      </div>
    </div>
  );
}
