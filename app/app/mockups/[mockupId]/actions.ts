"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export async function createPin(mockupId: string, x: number, y: number) {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("pins")
    .insert({ mockup_id: mockupId, x, y, created_by: userData.user!.id })
    .select("id, number")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/app/mockups/${mockupId}`);
  return { id: data.id as string, number: data.number as number };
}

export async function addComment(
  mockupId: string,
  pinId: string,
  body: string,
  parentCommentId?: string,
) {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("comments").insert({
    pin_id: pinId,
    author_id: userData.user!.id,
    body,
    parent_comment_id: parentCommentId ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/app/mockups/${mockupId}`);
  return {};
}

export async function setPinStatus(
  mockupId: string,
  pinId: string,
  status: "active" | "resolved",
) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("pins").update({ status }).eq("id", pinId);
  if (error) return { error: error.message };
  revalidatePath(`/app/mockups/${mockupId}`);
  return {};
}
