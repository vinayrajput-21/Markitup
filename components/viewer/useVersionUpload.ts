"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validateUpload } from "@/lib/validation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { createMockupUploadUrl, addMockupVersion } from "@/app/app/projects/[projectId]/actions";

// Shared client flow for uploading a new version of an existing file: signed
// URL → direct upload → record the version row. Mirrors UploadDropzone but
// finalizes via addMockupVersion so the new row joins the base's version group.
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

  function upload(file: File) {
    const check = validateUpload({ size: file.size, type: file.type });
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    start(async () => {
      const target = await createMockupUploadUrl(projectId, file.type);
      if ("error" in target && target.error) {
        setError(target.error);
        return;
      }
      const supabase = createBrowserSupabase();
      const { error: upErr } = await supabase.storage
        .from("mockups")
        .uploadToSignedUrl(target.path!, target.token!, file, { contentType: file.type });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      const res = await addMockupVersion(baseMockupId, target.path!);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (navigateToNew && res.id) router.push(`/app/mockups/${res.id}`);
      else router.refresh();
    });
  }

  return { pending, error, upload };
}
