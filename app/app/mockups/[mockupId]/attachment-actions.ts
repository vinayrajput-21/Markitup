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
  const path = `${projectId}/${crypto.randomUUID()}.${extFor(fileType)}`;
  const { data, error } = await supabase.storage.from("comment-files").createSignedUploadUrl(path);
  if (error) return { error: error.message };
  return { path: data.path, token: data.token };
}
