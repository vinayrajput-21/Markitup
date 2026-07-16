"use client";

import { RichCommentInput } from "@/components/viewer/RichCommentInput";

export function PinComposer({
  xPct,
  yPct,
  onCancel,
  onSubmit,
  pending,
  error,
}: {
  xPct: number;
  yPct: number;
  onCancel: () => void;
  onSubmit: (body: string) => void;
  pending: boolean;
  error?: string | null;
}) {
  return (
    <div
      className="absolute z-50 w-72 -translate-x-1/2 rounded-xl border bg-surface p-3 shadow-xl"
      style={{ left: `${xPct}%`, top: `${yPct}%`, marginTop: "14px" }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-muted transition-colors hover:text-brand-ink">
          Cancel
        </button>
      </div>
      <RichCommentInput
        projectId={""}
        placeholder="Add comment here…"
        pending={pending}
        onSubmit={(html) => onSubmit(html)}
      />
      {error && (
        <p className="mt-2 text-sm font-medium" style={{ color: "var(--color-danger)" }} role="alert">{error}</p>
      )}
    </div>
  );
}
