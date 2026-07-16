"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFolder } from "@/app/app/folders-actions";

export function NewFolderButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    const value = name.trim();
    if (!value) return;
    const fd = new FormData();
    fd.set("name", value);
    start(async () => {
      await createFolder(fd);
      setName("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary gap-1.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 11v4m-2-2h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        New folder
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
        placeholder="Folder name…"
        className="field h-10 w-44"
      />
      <button type="button" onClick={submit} disabled={pending} className="btn-primary btn-sm">Create</button>
      <button type="button" onClick={() => setOpen(false)} className="btn-secondary btn-sm">Cancel</button>
    </div>
  );
}
