"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveMockupToFolder } from "@/app/app/folder-actions";
import { useToast } from "@/components/ui/toast";

export type FolderOption = { id: string; name: string; depth: number };

export function MoveToFolderDialog({
  open,
  mockupId,
  mockupName,
  folders,
  currentFolderId,
  onClose,
}: {
  open: boolean;
  mockupId: string;
  mockupName: string;
  folders: FolderOption[];
  currentFolderId: string | null;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<string | null>(currentFolderId);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  if (!open) return null;

  function move() {
    start(async () => {
      const r = await moveMockupToFolder(mockupId, target);
      onClose();
      if (r?.error) toast.error(r.error);
      else { toast.success("Moved"); router.refresh(); }
    });
  }

  return (
    <div className="fixed inset-0 z-[300] grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="fade-anim absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="pop-anim relative z-10 w-full max-w-sm rounded-2xl border bg-surface-2 p-5 shadow-lg">
        <h2 className="truncate text-base font-bold text-ink">Move “{mockupName}”</h2>
        <p className="mt-1 text-xs text-muted">Choose a destination folder.</p>
        <div className="mt-3 max-h-64 space-y-0.5 overflow-y-auto rounded-lg border p-1">
          <Option label="Project root" active={target === null} onClick={() => setTarget(null)} depth={0} />
          {folders.map((f) => (
            <Option key={f.id} label={f.name} active={target === f.id} onClick={() => setTarget(f.id)} depth={f.depth} />
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={move} disabled={pending} className="btn-primary btn-sm">{pending ? "Moving…" : "Move here"}</button>
        </div>
      </div>
    </div>
  );
}

function Option({ label, active, onClick, depth }: { label: string; active: boolean; onClick: () => void; depth: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md py-2 pr-2.5 text-left text-sm transition-colors hover:bg-[color:var(--accent)]"
      style={{ paddingLeft: 10 + depth * 16, ...(active ? { background: "var(--color-brand-soft)", color: "var(--color-brand-ink)", fontWeight: 600 } : {}) }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <span className="truncate">{label}</span>
    </button>
  );
}
