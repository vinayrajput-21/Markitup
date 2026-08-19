"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/app/AppSidebar";
import { timeAgo } from "@/lib/format";
import { guestCreatePin, guestAddComment } from "@/app/s/[token]/guest-actions";
import type { ViewerPin, ViewerComment } from "./MockupViewer";

// Remembered guest display name (per browser). No account, just a label so the
// project owner can tell who left which comment.
const NAME_KEY = "mk_guest_name";
function useGuestName(): [string, (n: string) => void] {
  const [name, setName] = useState("");
  useEffect(() => {
    try { setName(localStorage.getItem(NAME_KEY) || ""); } catch {}
  }, []);
  const save = (n: string) => {
    setName(n);
    try { localStorage.setItem(NAME_KEY, n); } catch {}
  };
  return [name, save];
}

function NameField({ name, onName }: { name: string; onName: (n: string) => void }) {
  return (
    <input
      className="field mb-2"
      placeholder="Your name"
      value={name}
      maxLength={60}
      onChange={(e) => onName(e.target.value)}
    />
  );
}

let tmpSeq = 0;
function optimisticComment(name: string, body: string): ViewerComment {
  return {
    id: `guest-tmp-${++tmpSeq}`,
    body,
    authorName: name,
    parentCommentId: null,
    createdAt: new Date().toISOString(),
    attachments: [],
  };
}

// New-pin composer (mirrors PinComposer's placement).
export function GuestComposer({
  x,
  y,
  token,
  onCancel,
  onCreated,
}: {
  x: number;
  y: number;
  token: string;
  onCancel: () => void;
  onCreated: (pin: ViewerPin) => void;
}) {
  const [name, setName] = useGuestName();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return setError("Please enter your name.");
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    const pin = await guestCreatePin(token, x, y);
    if ("error" in pin) { setError(pin.error!); setPending(false); return; }
    const c = await guestAddComment(token, pin.id, body, name);
    if ("error" in c) { setError(c.error!); setPending(false); return; }
    onCreated({
      id: pin.id,
      x,
      y,
      number: pin.number,
      status: "active",
      comments: [optimisticComment(name, c.body ?? body)],
    });
  }

  return (
    <div
      className="pointer-events-auto absolute z-50 w-72 -translate-x-1/2 rounded-xl border bg-surface p-3 shadow-xl"
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, marginTop: "14px" }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
    >
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-muted transition-colors hover:text-brand-ink">Cancel</button>
      </div>
      <NameField name={name} onName={setName} />
      <textarea
        className="field field-textarea min-h-20"
        placeholder="Add your comment…"
        value={body}
        autoFocus
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="mt-2 flex justify-end">
        <button className="btn-primary btn-sm" disabled={pending || !body.trim()} onClick={submit}>
          {pending ? "Posting…" : "Comment"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm font-medium" style={{ color: "var(--color-danger)" }} role="alert">{error}</p>}
    </div>
  );
}

function Row({ c }: { c: ViewerComment }) {
  return (
    <div className="flex gap-2.5">
      <Avatar name={c.authorName} email={c.authorName} size={26} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-ink">{c.authorName}</span>
          <span className="shrink-0 font-mono text-[0.6875rem] text-faint">{timeAgo(c.createdAt)}</span>
        </div>
        <div className="mt-0.5 text-sm leading-relaxed break-words text-muted" dangerouslySetInnerHTML={{ __html: c.body }} />
      </div>
    </div>
  );
}

// Existing-pin popup: read the thread and add a reply (also guest-authored).
export function GuestThread({
  pin,
  token,
  onClose,
  onAdded,
}: {
  pin: ViewerPin;
  token: string;
  onClose: () => void;
  onAdded: (pinId: string, comment: ViewerComment) => void;
}) {
  const [name, setName] = useGuestName();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const roots = pin.comments.filter((c) => !c.parentCommentId);

  async function submit() {
    if (!name.trim()) return setError("Please enter your name.");
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    const res = await guestAddComment(token, pin.id, body, name);
    if ("error" in res) { setError(res.error!); setPending(false); return; }
    onAdded(pin.id, optimisticComment(name, res.body ?? body));
    setBody("");
    setPending(false);
  }

  return (
    <div
      className="pointer-events-auto absolute z-50 flex max-h-[70vh] w-80 -translate-x-1/2 flex-col overflow-hidden rounded-xl border bg-surface shadow-xl"
      style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%`, marginTop: "14px" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold text-ink">Comment #{pin.number}</span>
        <button onClick={onClose} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-[color:var(--accent)] hover:text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {roots.length ? roots.map((c) => <Row key={c.id} c={c} />) : <p className="text-sm text-faint">No comments yet.</p>}
      </div>
      <div className="border-t p-3">
        <NameField name={name} onName={setName} />
        <textarea
          className="field field-textarea min-h-16"
          placeholder="Reply…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <button className="btn-primary btn-sm" disabled={pending || !body.trim()} onClick={submit}>
            {pending ? "Posting…" : "Reply"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-medium" style={{ color: "var(--color-danger)" }} role="alert">{error}</p>}
      </div>
    </div>
  );
}
