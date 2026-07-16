"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { commentNotification } from "@/lib/email/templates";
import { sanitizeCommentHtml } from "@/lib/sanitize";

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
  const author = userData.user!;
  const cleanBody = sanitizeCommentHtml(body);
  const { error } = await supabase.from("comments").insert({
    pin_id: pinId,
    author_id: author.id,
    body: cleanBody,
    parent_comment_id: parentCommentId ?? null,
  });
  if (error) return { error: error.message };

  // Best-effort: notify the team (everyone but the author). Never fail the comment.
  try {
    const { data: mk } = await supabase
      .from("mockups")
      .select("name, project_id, projects(workspace_id)")
      .eq("id", mockupId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workspaceId = (mk as any)?.projects?.workspace_id as string | undefined;
    const projectId = mk?.project_id as string | undefined;
    if (mk && (workspaceId || projectId)) {
      const [{ data: wm }, { data: pm }] = await Promise.all([
        supabase.from("workspace_members").select("profiles(id, name, email)").eq("workspace_id", workspaceId ?? ""),
        supabase.from("project_members").select("profiles(id, name, email)").eq("project_id", projectId ?? ""),
      ]);
      const recipients = new Map<string, { id: string; name: string; email: string }>();
      for (const row of [...(wm ?? []), ...(pm ?? [])]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = (row as any).profiles;
        if (p?.id && p.id !== author.id && p.email) {
          recipients.set(p.email, { id: p.id, name: p.name ?? "there", email: p.email });
        }
      }
      const commenterName = (author.user_metadata?.name as string) || author.email || "Someone";
      for (const r of recipients.values()) {
        const tpl = commentNotification({
          recipientName: r.name,
          commenterName,
          mockupName: mk.name as string,
          body,
          mockupId,
        });
        await sendEmail({ to: r.email, ...tpl });
        await supabase.rpc("create_notification", {
          p_user_id: r.id,
          p_actor_id: author.id,
          p_type: "comment",
          p_mockup_id: mockupId,
          p_project_id: projectId ?? null,
          p_body: `${commenterName} commented on ${mk.name as string}`,
        });
      }
    }
  } catch (e) {
    console.error("[comment] notification failed", e);
  }

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
