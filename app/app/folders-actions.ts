"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

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
