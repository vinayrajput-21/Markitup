"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "./actions";

export async function createFolder(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Folder name is required" };
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("folders")
    .insert({ name, workspace_id: ws.id, created_by: userData.user!.id });
  if (error) return { error: error.message };
  revalidatePath("/app");
  return {};
}

export async function renameFolder(id: string, name: string) {
  const clean = name.trim();
  if (!clean) return { error: "Folder name is required" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("folders").update({ name: clean }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/app");
  return {};
}

export async function deleteFolder(id: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/app");
  return {};
}

export async function moveProjectToFolder(projectId: string, folderId: string | null) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("projects")
    .update({ folder_id: folderId })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/app");
  return {};
}

export async function archiveProject(projectId: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/archive");
  return {};
}

export async function unarchiveProject(projectId: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: null })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/archive");
  return {};
}
