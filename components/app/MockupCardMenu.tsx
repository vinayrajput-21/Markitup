"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveMockup, deleteMockup } from "@/app/app/projects/[projectId]/actions";
import { ShareDialog } from "@/components/viewer/ShareDialog";
import { CardMenu, MenuItem, ShareIcon, ArchiveIcon, TrashIcon } from "@/components/app/CardMenu";

export function MockupCardMenu({ mockupId }: { mockupId: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const router = useRouter();

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <>
      <CardMenu label="File options" onClose={() => setConfirm(false)}>
        {(close) =>
          confirm ? (
            <div className="p-1.5">
              <p className="px-1.5 pb-2 pt-1 text-xs text-muted">Delete this file and its comments?</p>
              <div className="flex gap-1.5 px-1.5 pb-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => { setConfirm(false); close(); run(() => deleteMockup(mockupId)); }}
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
              <MenuItem disabled={pending} onClick={() => { close(); run(() => archiveMockup(mockupId)); }}>
                <ArchiveIcon /> Archive
              </MenuItem>
              <MenuItem danger disabled={pending} onClick={() => setConfirm(true)}>
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
