"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFolder } from "@/app/app/folder-actions";
import { useToast } from "@/components/ui/toast";

export function NewFolderForm({ projectId, parentId }: { projectId: string; parentId: string | null }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    start(async () => {
      const r = await createFolder(projectId, parentId, name);
      if (r?.error) toast.error(r.error);
      else { setName(""); toast.success("Folder created"); router.refresh(); }
    });
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New folder name…" className="field h-10 w-52" />
      <button type="submit" disabled={pending || !name.trim()} className="btn-secondary gap-1.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M12 11v5M9.5 13.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {pending ? "Creating…" : "New folder"}
      </button>
    </form>
  );
}
