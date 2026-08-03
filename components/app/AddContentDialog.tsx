"use client";

import { useState } from "react";
import { UploadDropzone } from "@/components/viewer/UploadDropzone";
import { FigmaImport } from "@/components/viewer/FigmaImport";
import { createFolder } from "@/app/app/folder-actions";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";

const TABS = [
  { key: "upload", label: "Upload" },
  { key: "figma", label: "Figma" },
  { key: "folder", label: "New folder" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function AddContentDialog({ projectId, folderId }: { projectId: string; folderId: string | null }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("upload");
  const close = () => setOpen(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary btn-sm gap-1.5">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
        New
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="fade-anim absolute inset-0 bg-black/30" onClick={close} />
          <div className="pop-anim relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border bg-surface-2 shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-bold text-ink">Add to this project</h2>
              <button onClick={close} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-faint transition-colors hover:bg-[color:var(--accent)] hover:text-ink">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </div>

            <div className="px-5 pt-4">
              <div className="inline-flex rounded-md border bg-surface p-0.5">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className="rounded px-3 py-1 text-xs font-semibold transition-colors"
                    style={tab === t.key ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { color: "var(--muted-foreground)" }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 pt-4 pb-5">
              {tab === "upload" && <UploadDropzone projectId={projectId} folderId={folderId} onDone={close} />}
              {tab === "figma" && <FigmaImport projectId={projectId} folderId={folderId} onDone={close} />}
              {tab === "folder" && <FolderPanel projectId={projectId} parentId={folderId} onDone={close} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FolderPanel({ projectId, parentId, onDone }: { projectId: string; parentId: string | null; onDone: () => void }) {
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
      else { toast.success("Folder created"); router.refresh(); onDone(); }
    });
  }
  return (
    <form onSubmit={submit}>
      <label className="field-label">Folder name</label>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Landing pages" className="field" />
      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={pending || !name.trim()} className="btn-primary">{pending ? "Creating…" : "Create folder"}</button>
      </div>
    </form>
  );
}
