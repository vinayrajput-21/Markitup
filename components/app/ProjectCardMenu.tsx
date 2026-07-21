"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveProject, deleteProject } from "@/app/app/folders-actions";
import { CardMenu, MenuItem, LinkIcon, CheckIcon, ArchiveIcon, TrashIcon } from "@/components/app/CardMenu";

export function ProjectCardMenu({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  function copyLink(close: () => void) {
    const url = `${window.location.origin}/app/projects/${projectId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => { setCopied(false); close(); }, 1100);
    }).catch(() => close());
  }

  return (
    <CardMenu label="Project options" onClose={() => setConfirm(false)}>
      {(close) =>
        confirm ? (
          <div className="p-1.5">
            <p className="px-1.5 pb-2 pt-1 text-xs text-muted">Delete this project and all its files & comments?</p>
            <div className="flex gap-1.5 px-1.5 pb-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => { setConfirm(false); close(); run(() => deleteProject(projectId)); }}
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
            <MenuItem onClick={() => copyLink(close)}>
              {copied ? (
                <><CheckIcon /> Link copied</>
              ) : (
                <><LinkIcon /> Copy project link</>
              )}
            </MenuItem>
            <MenuItem disabled={pending} onClick={() => { close(); run(() => archiveProject(projectId)); }}>
              <ArchiveIcon /> Archive
            </MenuItem>
            <MenuItem danger disabled={pending} onClick={() => setConfirm(true)}>
              <TrashIcon /> Delete
            </MenuItem>
          </>
        )
      }
    </CardMenu>
  );
}
