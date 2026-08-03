"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveProject, deleteProject, renameProject } from "@/app/app/folders-actions";
import { CardMenu, MenuItem, LinkIcon, CheckIcon, ArchiveIcon, TrashIcon, PencilIcon } from "@/components/app/CardMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RenameDialog } from "@/components/ui/RenameDialog";
import { useToast } from "@/components/ui/toast";

export function ProjectCardMenu({ projectId, name }: { projectId: string; name: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const toast = useToast();

  function doRename(next: string) {
    start(async () => {
      const res = (await renameProject(projectId, next)) as { error?: string } | undefined;
      setRenameOpen(false);
      if (res?.error) toast.error(res.error);
      else toast.success("Project renamed");
      router.refresh();
    });
  }

  function run(fn: () => Promise<unknown>, successMsg: string) {
    start(async () => {
      const res = (await fn()) as { error?: string } | undefined;
      if (res?.error) toast.error(res.error);
      else toast.success(successMsg);
      router.refresh();
    });
  }

  function confirmDelete() {
    start(async () => {
      const res = (await deleteProject(projectId)) as { error?: string } | undefined;
      setConfirm(false);
      if (res?.error) toast.error(res.error);
      else toast.success(`“${name}” deleted`, { description: "Project and all its files removed." });
      router.refresh();
    });
  }

  function copyLink(close: () => void) {
    const url = `${window.location.origin}/app/projects/${projectId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      toast.success("Project link copied");
      setTimeout(() => { setCopied(false); close(); }, 1100);
    }).catch(() => close());
  }

  return (
    <>
      <CardMenu label="Project options">
        {(close) => (
          <>
            <MenuItem onClick={() => copyLink(close)}>
              {copied ? (<><CheckIcon /> Link copied</>) : (<><LinkIcon /> Copy project link</>)}
            </MenuItem>
            <MenuItem disabled={pending} onClick={() => { close(); setRenameOpen(true); }}>
              <PencilIcon /> Rename
            </MenuItem>
            <MenuItem disabled={pending} onClick={() => { close(); run(() => archiveProject(projectId), `“${name}” archived`); }}>
              <ArchiveIcon /> Archive
            </MenuItem>
            <MenuItem danger disabled={pending} onClick={() => { close(); setConfirm(true); }}>
              <TrashIcon /> Delete
            </MenuItem>
          </>
        )}
      </CardMenu>

      <ConfirmDialog
        open={confirm}
        title="Delete this project?"
        message={<>This permanently deletes <b className="text-ink">“{name}”</b> and every mockup, version and comment inside it. This action cannot be undone.</>}
        confirmLabel="Delete project"
        pendingLabel="Deleting…"
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirm(false)}
      />
      <RenameDialog open={renameOpen} label="Rename project" initial={name} pending={pending} onSave={doRename} onClose={() => setRenameOpen(false)} />
    </>
  );
}
