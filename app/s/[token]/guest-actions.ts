"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { sanitizeCommentHtml } from "@/lib/sanitize";

// Guest (no-login) feedback on a PUBLIC share link. Every call goes through a
// SECURITY DEFINER RPC that re-validates the token is public and scopes the
// write to that token's mockup — so a logged-out visitor can only ever touch
// the one design they were given a public link to.

export async function guestCreatePin(token: string, x: number, y: number) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("guest_create_pin", {
    p_token: token,
    p_x: x,
    p_y: y,
  });
  if (error) return { error: "Could not add your pin — the link may no longer be public." };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return { error: "Could not add your pin. Please try again." };
  return { id: row.id as string, number: row.number as number };
}

export async function guestAddComment(token: string, pinId: string, body: string, name: string) {
  if (!name.trim()) return { error: "Please enter your name first." };
  const clean = sanitizeCommentHtml(body);
  if (!clean.trim()) return { error: "Your comment can't be empty." };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("guest_add_comment", {
    p_token: token,
    p_pin_id: pinId,
    p_body: clean,
    p_name: name.trim(),
  });
  if (error) return { error: "Could not post your comment. Please try again." };
  return { id: data as string, body: clean };
}
