"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unarchiveMockup } from "@/app/app/projects/[projectId]/actions";

export function MockupRestoreButton({ mockupId }: { mockupId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await unarchiveMockup(mockupId); router.refresh(); })}
      className="btn-secondary btn-sm"
    >
      {pending ? "Restoring…" : "Restore"}
    </button>
  );
}
