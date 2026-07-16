"use client";

import { useRef, useState } from "react";
import type { ViewerPin, ViewerComment } from "./MockupViewer";
import { addComment, setPinStatus } from "@/app/app/mockups/[mockupId]/actions";
import { Avatar } from "@/components/app/AppSidebar";
import { timeAgo, formatDateTime } from "@/lib/format";

export type Member = { id: string; name: string };

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Render comment text with @mentions of known members highlighted.
function MentionText({ text, names }: { text: string; names: string[] }) {
  if (!names.length) return <>{text}</>;
  const sorted = [...names].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const re = new RegExp(`@(${sorted.join("|")})`, "g");
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <span key={m.index} className="rounded bg-brand-soft px-1 font-medium text-brand-ink">
        @{m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

function CommentRow({ c, names, small = false }: { c: ViewerComment; names: string[]; small?: boolean }) {
  return (
    <div className="flex gap-2.5">
      <Avatar name={c.authorName} email={c.authorName} size={small ? 24 : 30} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-ink">{c.authorName}</span>
          <span className="shrink-0 font-mono text-[0.6875rem] text-faint" title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</span>
        </div>
        <p className="mt-0.5 text-sm leading-relaxed break-words text-muted">
          <MentionText text={c.body} names={names} />
        </p>
      </div>
    </div>
  );
}

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
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const roots = pin.comments.filter((c) => !c.parentCommentId);
  const repliesOf = (id: string) => pin.comments.filter((c) => c.parentCommentId === id);
  const resolved = pin.status === "resolved";
  const memberNames = members.map((m) => m.name).filter(Boolean);

  const suggestions =
    mentionQuery === null
      ? []
      : members
          .filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
          .slice(0, 6);

  function onBodyChange(value: string, caret: number) {
    setBody(value);
    const before = value.slice(0, caret);
    const match = before.match(/@(\S*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionStart(caret - match[0].length);
    } else {
      setMentionQuery(null);
    }
  }

  function pickMention(name: string) {
    const end = mentionStart + 1 + (mentionQuery?.length ?? 0);
    const next = body.slice(0, mentionStart) + "@" + name + " " + body.slice(end);
    setBody(next);
    setMentionQuery(null);
    taRef.current?.focus();
  }

  async function post() {
    const text = body.trim();
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
    setBody("");
    setReplyTo(null);
    setMentionQuery(null);
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
            <CommentRow c={c} names={memberNames} />
            <div className="mt-2 ml-3.5 space-y-3 border-l pl-4">
              {repliesOf(c.id).map((r) => (
                <CommentRow key={r.id} c={r} names={memberNames} small />
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

        {mentionQuery !== null && suggestions.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 z-20 mb-1 overflow-hidden rounded-lg border bg-surface-2 shadow-lg">
            {suggestions.map((m) => (
              <button
                key={m.id}
                onMouseDown={(e) => { e.preventDefault(); pickMention(m.name); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[color:var(--accent)]"
              >
                <Avatar name={m.name} email={m.name} size={24} />
                <span className="truncate text-sm text-ink">{m.name}</span>
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={taRef}
          value={body}
          onChange={(e) => onBodyChange(e.target.value, e.target.selectionStart)}
          onKeyDown={(e) => {
            if (mentionQuery !== null && suggestions.length > 0 && e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
              e.preventDefault();
              pickMention(suggestions[0].name);
              return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") post();
          }}
          placeholder="Add a comment…  use @ to mention"
          className="field field-textarea text-sm"
          rows={2}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[0.6875rem] text-faint">@ to mention · ⌘↵ to send</span>
          <button onClick={post} disabled={!body.trim()} className="btn-primary btn-sm">Comment</button>
        </div>
      </div>
    </div>
  );
}
