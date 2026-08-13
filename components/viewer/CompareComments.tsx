"use client";

import type { ViewerPin, ViewerComment } from "./MockupViewer";
import { Avatar } from "@/components/app/AppSidebar";
import { timeAgo, formatDateTime } from "@/lib/format";

export type CompareCommentGroup = {
  key: string; // mockup id
  label: string; // "Version 3"
  pins: ViewerPin[];
};

function CommentRow({ c, small = false }: { c: ViewerComment; small?: boolean }) {
  return (
    <div className="flex gap-2.5">
      <Avatar name={c.authorName} email={c.authorName} size={small ? 22 : 28} />
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
                  <img src={a.url} alt={a.name} className="h-20 w-20 rounded-md border object-cover" />
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

function PinCard({ pin }: { pin: ViewerPin }) {
  const roots = pin.comments.filter((c) => !c.parentCommentId);
  const repliesOf = (id: string) => pin.comments.filter((c) => c.parentCommentId === id);
  const resolved = pin.status === "resolved";
  return (
    <div className="border-b px-4 py-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="grid h-5 w-5 place-items-center rounded-full font-mono text-[0.6875rem] font-bold"
          style={{ background: resolved ? "var(--success)" : "var(--primary)", color: resolved ? "#fff" : "var(--primary-foreground)" }}
        >
          {pin.number}
        </span>
        {resolved && <span className="text-[0.6875rem] font-semibold tracking-wide uppercase" style={{ color: "var(--success)" }}>Resolved</span>}
      </div>
      <div className="space-y-4">
        {roots.length === 0 && <p className="text-sm text-faint">No comments.</p>}
        {roots.map((c) => (
          <div key={c.id}>
            <CommentRow c={c} />
            {repliesOf(c.id).length > 0 && (
              <div className="mt-2 ml-3 space-y-3 border-l pl-3.5">
                {repliesOf(c.id).map((r) => (
                  <CommentRow key={r.id} c={r} small />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompareComments({ groups }: { groups: CompareCommentGroup[] }) {
  const total = groups.reduce((n, g) => n + g.pins.reduce((m, p) => m + p.comments.length, 0), 0);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted" aria-hidden>
          <path d="M4 5h16v10H9l-5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-bold text-ink">Comments</span>
        <span className="chip" style={{ background: "var(--color-canvas)", color: "var(--color-muted)" }}>{total}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {total === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-faint">No comments on this file yet.</p>
        ) : (
          groups
            .filter((g) => g.pins.some((p) => p.comments.length > 0))
            .map((g) => (
              <div key={g.key}>
                <div className="sticky top-0 z-10 border-b bg-surface px-4 py-2 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase backdrop-blur">
                  {g.label}
                </div>
                {g.pins
                  .filter((p) => p.comments.length > 0)
                  .map((pin) => (
                    <PinCard key={pin.id} pin={pin} />
                  ))}
              </div>
            ))
        )}
      </div>
    </div>
  );
}
