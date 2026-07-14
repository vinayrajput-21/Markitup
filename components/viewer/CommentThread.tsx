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
