"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveMockup, deleteMockup } from "@/app/app/projects/[projectId]/actions";
import { ShareDialog } from "@/components/viewer/ShareDialog";
import { useVersionUpload } from "@/components/viewer/useVersionUpload";
import { CardMenu, MenuItem, ShareIcon, ArchiveIcon, TrashIcon } from "@/components/app/CardMenu";
import { useToast } from "@/components/ui/toast";

export function MockupCardMenu({ mockupId, projectId }: { mockupId: string; projectId: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const { pending: uploading, upload } = useVersionUpload({ baseMockupId: mockupId, projectId });

  function run(fn: () => Promise<unknown>, successMsg: string) {
    start(async () => {
      const res = (await fn()) as { error?: string } | undefined;
      if (res?.error) toast.error(res.error);
      else toast.success(successMsg);
      router.refresh();
    });
  }

  const busy = pending || uploading;

  return (
    <>
      {/* Kept outside the dropdown so the file picker survives the menu closing. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <CardMenu label="File options" onClose={() => setConfirm(false)}>
        {(close) =>
          confirm ? (
            <div className="p-1.5">
              <p className="px-1.5 pb-2 pt-1 text-xs text-muted">Delete this file and its comments?</p>
              <div className="flex gap-1.5 px-1.5 pb-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setConfirm(false); close(); run(() => deleteMockup(mockupId), "File deleted"); }}
                  className="btn-sm flex-1 rounded-md px-2 py-1 text-center text-sm font-semibold text-white"
                  style={{ background: "var(--color-danger)" }}
                >
                  Delete
                </button>
                <button type="button" onClick={() => setConfirm(false)} className="btn-secondary btn-sm flex-1">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <MenuItem onClick={() => { close(); setShareOpen(true); }}>
                <ShareIcon /> Share
              </MenuItem>
              <MenuItem disabled={busy} onClick={() => { close(); inputRef.current?.click(); }}>
                <UploadIcon /> {uploading ? "Uploading…" : "Upload new version"}
              </MenuItem>
              <MenuItem disabled={busy} onClick={() => { close(); run(() => archiveMockup(mockupId), "File archived"); }}>
                <ArchiveIcon /> Archive
              </MenuItem>
              <MenuItem danger disabled={busy} onClick={() => setConfirm(true)}>
                <TrashIcon /> Delete
              </MenuItem>
            </>
          )
        }
      </CardMenu>
      <ShareDialog mockupId={mockupId} hideTrigger open={shareOpen} onOpenChange={setShareOpen} />
    </>
  );
}

function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 16V5m0 0 4 4m-4-4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15v2.5A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
