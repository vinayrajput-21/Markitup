"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/validation";

function extForType(type: string) {
  return type === "image/png" ? "png" : "jpg";
}

// Step 1 of the upload. The browser sends only the file *type* here; the action
// returns a short-lived signed upload URL so the file *bytes* can go straight
// from the browser to Supabase Storage. This bypasses the Server Action request
// body — Vercel caps function request bodies at 4.5MB regardless of
// `serverActions.bodySizeLimit`, which would otherwise reject large mockups.
//
// Creating the signed URL uses the caller's session, so the storage "write
// mockup objects" RLS policy (can_see_project) is enforced here: a non-member
// cannot obtain a token for a project's folder.
export async function createMockupUploadUrl(projectId: string, fileType: string) {
  if (!ACCEPTED_IMAGE_TYPES.includes(fileType as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return { error: "Only PNG and JPG images are supported." };
  }

  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "You must be signed in to upload." };

  const path = `${projectId}/${crypto.randomUUID()}.${extForType(fileType)}`;
  const { data, error } = await supabase.storage
    .from("mockups")
    .createSignedUploadUrl(path);
  if (error) return { error: error.message };

  return { path: data.path, token: data.token };
}

// Step 2 of the upload. After the browser finishes the direct upload, record
// the mockup row. Only a reference (the storage path) crosses the wire, never
// the bytes. The `mockups` INSERT RLS policy re-checks project membership.
export async function finalizeMockup(
  projectId: string,
  path: string,
  name: string,
) {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "You must be signed in to upload." };

  // The object must live under this project's folder. Without this, a caller
  // could point a project's row at a file uploaded to a different folder.
  if (!path.startsWith(`${projectId}/`)) {
    return { error: "Invalid upload path." };
  }

  const { error: insErr } = await supabase.from("mockups").insert({
    project_id: projectId,
    name,
    type: "image",
    file_path: path,
    created_by: userData.user.id,
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
