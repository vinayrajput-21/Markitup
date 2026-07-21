"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validateUpload } from "@/lib/validation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { createMockupUploadUrl, addMockupVersion } from "@/app/app/projects/[projectId]/actions";

// Shared client flow for uploading a new version of an existing file: signed
// URL → direct upload → record the version row. Surfaces a live progress toast
// that morphs into success/error.
export function useVersionUpload({
  baseMockupId,
  projectId,
  navigateToNew = false,
}: {
  baseMockupId: string;
  projectId: string;
  navigateToNew?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  function upload(file: File) {
    const check = validateUpload({ size: file.size, type: file.type });
    if (!check.ok) {
      setError(check.error);
      toast.error(check.error);
      return;
    }
    setError(null);
    const id = toast.push({ title: "Uploading new version…", variant: "loading", progress: 0.06 });
    let p = 0.06;

    start(async () => {
      const iv = setInterval(() => {
        p = p < 0.92 ? p + (0.92 - p) * 0.14 : p;
        toast.update(id, { progress: p });
      }, 160);
      const failToast = (message: string) => {
        clearInterval(iv);
        setError(message);
        toast.update(id, { variant: "error", title: "Upload failed", description: message, progress: undefined, duration: 4000 });
      };
      try {
        const target = await createMockupUploadUrl(projectId, file.type);
        if ("error" in target && target.error) return failToast(target.error);

        const supabase = createBrowserSupabase();
        const { error: upErr } = await supabase.storage
          .from("mockups")
          .uploadToSignedUrl(target.path!, target.token!, file, { contentType: file.type });
        if (upErr) return failToast(upErr.message);

        const res = await addMockupVersion(baseMockupId, target.path!);
        clearInterval(iv);
        if (res.error) return failToast(res.error);

        toast.update(id, { variant: "success", title: "New version uploaded", description: undefined, progress: 1, duration: 2500 });
        if (navigateToNew && res.id) router.push(`/app/mockups/${res.id}`);
        else router.refresh();
      } catch {
        failToast("Upload failed. Please try again.");
      }
    });
  }

  return { pending, error, upload };
}
