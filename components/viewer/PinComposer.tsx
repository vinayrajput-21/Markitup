"use client";

import { useState } from "react";

export function PinComposer({
  xPct,
  yPct,
  onCancel,
  onSubmit,
  pending,
}: {
  xPct: number;
  yPct: number;
  onCancel: () => void;
  onSubmit: (body: string) => void;
  pending: boolean;
}) {
  const [body, setBody] = useState("");
  return (
    <div
      className="absolute z-50 w-72 -translate-x-1/2 rounded-xl border bg-surface p-3 shadow-xl"
      style={{ left: `${xPct}%`, top: `${yPct}%`, marginTop: "14px" }}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add comment here…"
        rows={3}
        className="field w-full resize-none text-sm"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && body.trim()) onSubmit(body.trim());
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary btn-sm">Cancel</button>
        <button
          type="button"
          disabled={pending || !body.trim()}
          onClick={() => onSubmit(body.trim())}
          className="btn-primary btn-sm"
        >
          {pending ? "Saving…" : "Comment"}
        </button>
      </div>
    </div>
  );
}
