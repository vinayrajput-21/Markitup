"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export async function createFolder(projectId: string, parentId: string | null, name: string) {
  const clean = name.trim();
  if (!clean) return { error: "Enter a folder name" };
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("mockup_folders").insert({
    project_id: projectId,
    parent_id: parentId,
    name: clean.slice(0, 80),
    created_by: userData.user?.id ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/app/projects/${projectId}`);
  return {};
}

export async function renameFolder(folderId: string, name: string) {
  const clean = name.trim();
  if (!clean) return { error: "Enter a name" };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("mockup_folders")
    .update({ name: clean.slice(0, 80) })
    .eq("id", folderId)
    .select("project_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (data?.project_id) revalidatePath(`/app/projects/${data.project_id}`);
  return {};
}

// Deletes a folder. Sub-folders cascade; contained mockups fall back to the
// project root (folder_id set null), so no files are lost.
export async function deleteFolder(folderId: string) {
  const supabase = await createServerSupabase();
  const { data: f } = await supabase.from("mockup_folders").select("project_id").eq("id", folderId).maybeSingle();
  const { error } = await supabase.from("mockup_folders").delete().eq("id", folderId);
  if (error) return { error: error.message };
  if (f?.project_id) revalidatePath(`/app/projects/${f.project_id}`);
  return {};
}

export async function moveMockupToFolder(mockupId: string, folderId: string | null) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("mockups")
    .update({ folder_id: folderId })
    .eq("id", mockupId)
    .select("project_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (data?.project_id) revalidatePath(`/app/projects/${data.project_id}`);
  return {};
}
