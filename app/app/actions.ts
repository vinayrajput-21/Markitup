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

export async function getWorkspaceMembers() {
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return [];
  const { data } = await supabase
    .from("workspace_members")
    .select("role, profiles(id, name, email)")
    .eq("workspace_id", ws.id);
  return (data ?? []).map((m) => {
    const p = m.profiles as unknown as { id: string; name: string; email: string };
    return { id: p.id, name: p.name, email: p.email, role: m.role as string };
  });
}

export async function addMemberByEmail(formData: FormData) {
  const email = String(formData.get("email")).trim().toLowerCase();
  if (!email) return { error: "Email required" };
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const { data: userData } = await supabase.auth.getUser();

  const { data: profileId } = await supabase.rpc("find_profile_id_by_email", {
    p_email: email,
  });

  if (profileId) {
    const { error } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: profileId, role: "member" });
    if (error) return { error: error.message };
    revalidatePath("/app/members");
    return { invited: false };
  }

  const { error } = await supabase
    .from("invitations")
    .insert({ workspace_id: ws.id, email, invited_by: userData.user!.id });
  if (error) return { error: error.message };
  revalidatePath("/app/members");
  return { invited: true };
}
