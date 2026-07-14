"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { validateUpload } from "@/lib/validation";

export async function uploadMockup(projectId: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };

  const check = validateUpload({ size: file.size, type: file.type });
  if (!check.ok) return { error: check.error };

  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${projectId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("mockups")
    .upload(path, file, { contentType: file.type });
  if (upErr) return { error: upErr.message };

  const { error: insErr } = await supabase.from("mockups").insert({
    project_id: projectId,
    name: file.name,
    type: "image",
    file_path: path,
    created_by: userData.user!.id,
  });
  if (insErr) return { error: insErr.message };

  revalidatePath(`/app/projects/${projectId}`);
  return {};
}

export async function getMockupSignedUrl(filePath: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.storage
    .from("mockups")
    .createSignedUrl(filePath, 60 * 60);
  return data?.signedUrl ?? null;
}
