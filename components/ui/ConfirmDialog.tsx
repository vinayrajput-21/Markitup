"use client";

import { useEffect, useRef } from "react";

// A prominent, centered confirmation modal for destructive actions.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  pending = false,
  pendingLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  pendingLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fade-anim absolute inset-0 bg-black/50" onClick={() => { if (!pending) onCancel(); }} />
      <div className="pop-anim relative z-10 w-full max-w-md rounded-2xl border bg-surface-2 p-6 shadow-lg">
        <div className="flex gap-4">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
            style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={pending} className="btn-secondary">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={pending} className="btn-danger">
            {pending ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.6" opacity="0.35" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                </svg>
                {pendingLabel ?? confirmLabel}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
