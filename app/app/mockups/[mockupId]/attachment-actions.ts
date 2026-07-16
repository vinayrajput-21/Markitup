"use server";

import { createServerSupabase } from "@/lib/supabase/server";

const TYPES: Record<string, "image" | "pdf" | undefined> = {
  "image/png": "image",
  "image/jpeg": "image",
  "application/pdf": "pdf",
};

function extFor(fileType: string) {
  if (fileType === "image/png") return "png";
  if (fileType === "image/jpeg") return "jpg";
  return "pdf";
}

export async function createAttachmentUploadUrl(projectId: string, fileType: string) {
  if (!TYPES[fileType]) return { error: "Only PNG, JPG, and PDF attachments are supported." };
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "You must be signed in." };
  // Defense-in-depth: don't trust the client-supplied projectId. Storage RLS also
  // gates the actual upload, but verify visibility before handing out a signed URL.
  const { data: canSee } = await supabase.rpc("can_see_project", { p: projectId });
  if (!canSee) return { error: "You don't have access to this project." };
  const path = `${projectId}/${crypto.randomUUID()}.${extFor(fileType)}`;
  const { data, error } = await supabase.storage.from("comment-files").createSignedUploadUrl(path);
  if (error) return { error: error.message };
  return { path: data.path, token: data.token };
}
