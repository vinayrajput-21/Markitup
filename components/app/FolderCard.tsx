"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { renameFolder, deleteFolder } from "@/app/app/folder-actions";
import { CardMenu, MenuItem, TrashIcon } from "@/components/app/CardMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toast";

export function FolderCard({ id, name, href }: { id: string; name: string; href: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(name);
  const router = useRouter();
  const toast = useToast();

  function doRename() {
    if (!value.trim() || value.trim() === name) { setRenaming(false); return; }
    start(async () => {
      const r = await renameFolder(id, value);
      setRenaming(false);
      if (r?.error) toast.error(r.error);
      else { toast.success("Folder renamed"); router.refresh(); }
    });
  }
  function doDelete() {
    start(async () => {
      const r = await deleteFolder(id);
      setConfirm(false);
      if (r?.error) toast.error(r.error);
      else { toast.success(`“${name}” deleted`); router.refresh(); }
    });
  }

  return (
    <>
      <div className="card card-hover relative flex items-center gap-3 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
        </span>

        {renaming ? (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={doRename}
            onKeyDown={(e) => { if (e.key === "Enter") doRename(); if (e.key === "Escape") { setValue(name); setRenaming(false); } }}
            className="field h-8 min-w-0 flex-1 text-sm"
          />
        ) : (
          <Link href={href} className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-ink">{name}</span>
            <span className="text-xs text-faint">Folder</span>
          </Link>
        )}

        <div className="flex shrink-0 items-center gap-0.5">
          <CardMenu label="Folder options">
            {(close) => (
              <>
                <MenuItem onClick={() => { close(); setValue(name); setRenaming(true); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
                  Rename
                </MenuItem>
                <MenuItem danger disabled={pending} onClick={() => { close(); setConfirm(true); }}>
                  <TrashIcon /> Delete
                </MenuItem>
              </>
            )}
          </CardMenu>
          <Link href={href} aria-label={`Open ${name}`} className="grid h-7 w-7 place-items-center rounded-md text-faint transition-colors hover:bg-[color:var(--accent)] hover:text-ink">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m10 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Delete this folder?"
        message={<>Deleting <b className="text-ink">“{name}”</b> removes the folder and any sub-folders. Files inside are moved to the project root — nothing is lost.</>}
        confirmLabel="Delete folder"
        pendingLabel="Deleting…"
        pending={pending}
        onConfirm={doDelete}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
