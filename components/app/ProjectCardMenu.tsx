"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveProjectToFolder, archiveProject } from "@/app/app/folders-actions";

export function ProjectCardMenu({
  projectId,
  folders,
  currentFolderId,
}: {
  projectId: string;
  folders: { id: string; name: string }[];
  currentFolderId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<unknown>) {
    setOpen(false);
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Project options"
        disabled={pending}
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-[color:var(--accent)] hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="5" cy="12" r="1.6" fill="currentColor" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          <circle cx="19" cy="12" r="1.6" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.preventDefault(); setOpen(false); }} />
          <div className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-lg border bg-surface-2 p-1 shadow-lg">
            <p className="px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-faint">Move to folder</p>
            {currentFolderId && (
              <button onClick={() => run(() => moveProjectToFolder(projectId, null))} className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-[color:var(--accent)]">
                No folder (top level)
              </button>
            )}
            {folders.filter((f) => f.id !== currentFolderId).map((f) => (
              <button key={f.id} onClick={() => run(() => moveProjectToFolder(projectId, f.id))} className="block w-full truncate rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-[color:var(--accent)]">
                {f.name}
              </button>
            ))}
            {folders.length === 0 && !currentFolderId && (
              <p className="px-2.5 py-1.5 text-xs text-faint">No folders yet</p>
            )}
            <div className="my-1 border-t" />
            <button onClick={() => run(() => archiveProject(projectId))} className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-[color:var(--accent)]" style={{ color: "var(--color-danger)" }}>
              Archive project
            </button>
          </div>
        </>
      )}
    </div>
  );
}
