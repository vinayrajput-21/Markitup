"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unarchiveProject } from "@/app/app/folders-actions";
import { useToast } from "@/components/ui/toast";

export function UnarchiveButton({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => {
        const res = (await unarchiveProject(projectId)) as { error?: string } | undefined;
        if (res?.error) toast.error(res.error); else toast.success("Project restored");
        router.refresh();
      })}
      className="btn-secondary btn-sm"
    >
      {pending ? "Restoring…" : "Restore"}
    </button>
  );
}
