"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "./actions";
import { sendEmail } from "@/lib/email/send";
import { clientShareEmail, reminderEmail } from "@/lib/email/templates";
import { fillTemplate, REMINDER_DEFAULTS, type ReminderSettings } from "@/lib/reminders";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://markitup-woad.vercel.app";

export type ScheduleRow = {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  mockupName: string | null;
  sentCount: number;
  nextDueAt: string;
  status: string;
  createdAt: string;
};

export async function getReminderData(): Promise<{ settings: ReminderSettings; schedules: ScheduleRow[] }> {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const wsId = ws?.id ?? "";

  const { data: s } = await supabase.from("reminder_settings").select("*").eq("workspace_id", wsId).maybeSingle();
  const settings: ReminderSettings = s
    ? {
        enabled: s.enabled, days_between: s.days_between, max_count: s.max_count,
        stop_on_feedback: s.stop_on_feedback, weekdays_only: s.weekdays_only,
        cc_me: s.cc_me, notify_never: s.notify_never,
        subject: s.subject, message: s.message, button_label: s.button_label,
      }
    : { ...REMINDER_DEFAULTS };

  const { data: rows } = await supabase
    .from("reminder_schedules")
    .select("id, recipient_email, recipient_name, sent_count, next_due_at, status, created_at, mockups(name)")
    .eq("workspace_id", wsId)
    .order("created_at", { ascending: false })
    .limit(20);
  const schedules: ScheduleRow[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    recipientEmail: r.recipient_email as string,
    recipientName: (r.recipient_name as string) ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockupName: ((r as any).mockups?.name as string) ?? null,
    sentCount: r.sent_count as number,
    nextDueAt: r.next_due_at as string,
    status: r.status as string,
    createdAt: r.created_at as string,
  }));

  return { settings, schedules };
}

export async function saveReminderSettings(input: ReminderSettings) {
  const ws = await getCurrentWorkspace();
  if (!ws?.id) return { error: "No workspace" };
  const supabase = await createServerSupabase();
  const row = {
    workspace_id: ws.id,
    enabled: !!input.enabled,
    days_between: Math.min(30, Math.max(1, Math.round(input.days_between))),
    max_count: Math.min(10, Math.max(1, Math.round(input.max_count))),
    stop_on_feedback: !!input.stop_on_feedback,
    weekdays_only: !!input.weekdays_only,
    cc_me: !!input.cc_me,
    notify_never: !!input.notify_never,
    subject: input.subject.slice(0, 200),
    message: input.message.slice(0, 2000),
    button_label: input.button_label.slice(0, 60),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("reminder_settings").upsert(row, { onConflict: "workspace_id" });
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return {};
}

export async function sendTestReminder(settings: ReminderSettings) {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email;
  if (!email) return { error: "No email on your account" };
  const senderName = (userData.user?.user_metadata?.name as string) || email;
  const vars = { page_name: "Homepage file", sender: senderName, type: "file", project: ws?.name ?? "Demo project" };
  const tpl = reminderEmail({
    subject: fillTemplate(settings.subject, vars),
    message: fillTemplate(settings.message, vars),
    buttonLabel: settings.button_label,
    href: `${APP_URL}/app`,
  });
  const res = await sendEmail({ to: email, ...tpl });
  return res.ok ? { sentTo: email } : { error: "Could not send — check that email is configured." };
}

export async function sendToClient(mockupId: string, email: string, name?: string) {
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Enter a valid email address" };

  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const { data: mk } = await supabase
    .from("mockups")
    .select("name, project_id, projects(name, workspace_id)")
    .eq("id", mockupId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proj = (mk as any)?.projects;
  const workspaceId = proj?.workspace_id as string | undefined;
  const pageName = (mk?.name as string) ?? "your design";
  if (!mk || !workspaceId) return { error: "File not found" };

  // get-or-create a public share link so the client can open it without an account
  let { data: link } = await supabase.from("share_links").select("token, visibility").eq("mockup_id", mockupId).maybeSingle();
  if (!link) {
    const { data: created, error } = await supabase
      .from("share_links")
      .insert({ mockup_id: mockupId, created_by: userData.user!.id, visibility: "public" })
      .select("token, visibility")
      .single();
    if (error) return { error: error.message };
    link = created;
  } else if (link.visibility !== "public") {
    await supabase.from("share_links").update({ visibility: "public" }).eq("mockup_id", mockupId);
  }
  const token = link!.token as string;
  const href = `${APP_URL}/s/${token}`;
  const senderName = (userData.user?.user_metadata?.name as string) || userData.user?.email || "Your designer";

  // initial share email
  await sendEmail({ to: clean, ...clientShareEmail({ sender: senderName, pageName, href }) });

  // schedule follow-ups only when reminders are enabled for this workspace
  const { data: st } = await supabase
    .from("reminder_settings")
    .select("enabled, days_between")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const enabled = !!st?.enabled;
  if (enabled) {
    const days = st?.days_between ?? 3;
    const nextDue = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
    await supabase.from("reminder_schedules").insert({
      workspace_id: workspaceId,
      mockup_id: mockupId,
      recipient_email: clean,
      recipient_name: name?.trim() || null,
      share_token: token,
      created_by: userData.user!.id,
      next_due_at: nextDue,
      status: "active",
    });
  }
  revalidatePath(`/app/mockups/${mockupId}`);
  return { ok: true, scheduled: enabled };
}
