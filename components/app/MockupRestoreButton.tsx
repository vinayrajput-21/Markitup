"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unarchiveMockup } from "@/app/app/projects/[projectId]/actions";
import { useToast } from "@/components/ui/toast";

export function MockupRestoreButton({ mockupId }: { mockupId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => {
        const res = (await unarchiveMockup(mockupId)) as { error?: string } | undefined;
        if (res?.error) toast.error(res.error); else toast.success("File restored");
        router.refresh();
      })}
      className="btn-secondary btn-sm"
    >
      {pending ? "Restoring…" : "Restore"}
    </button>
  );
}
