"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export async function getCurrentWorkspace() {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership?.workspaces) {
    const ws = membership.workspaces as unknown as { id: string; name: string };
    return { id: ws.id, name: ws.name };
  }

  const name = (user.user_metadata?.name as string) || user.email || "My";
  const { data: ws } = await supabase
    .from("workspaces")
    .insert({ name: `${name}'s Workspace`, owner_id: user.id })
    .select()
    .single();
  if (!ws) return null;

  await supabase
    .from("workspace_members")
    .insert({ workspace_id: ws.id, user_id: user.id, role: "owner" });

  return { id: ws.id as string, name: ws.name as string };
}

export async function createProject(formData: FormData) {
  const name = String(formData.get("name")).trim();
  if (!name) return { error: "Project name is required" };
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("projects")
    .insert({ name, workspace_id: ws.id, created_by: userData.user!.id });
  if (error) return { error: error.message };
  revalidatePath("/app");
}
