"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unarchiveProject } from "@/app/app/folders-actions";

export function UnarchiveButton({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await unarchiveProject(projectId); router.refresh(); })}
      className="btn-secondary btn-sm"
    >
      {pending ? "Restoring…" : "Restore"}
    </button>
  );
}
