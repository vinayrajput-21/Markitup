"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/app/app/actions";
import { sendEmail } from "@/lib/email/send";
import { templatedEmail } from "@/lib/email/templates";
import {
  EMAIL_TEMPLATE_DEFAULTS,
  EMAIL_TEMPLATE_META,
  fillEmailTemplate,
  type EmailTemplate,
  type EmailTemplateKey,
} from "@/lib/email-templates";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://markitup-woad.vercel.app";
const KEYS: EmailTemplateKey[] = ["client_invite", "team_invite"];

async function isAdmin(supabase: Awaited<ReturnType<typeof createServerSupabase>>, wsId: string, userId: string) {
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", wsId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data && (data.role === "owner" || data.role === "admin");
}

export type EmailTemplatesData = {
  templates: Record<EmailTemplateKey, EmailTemplate>;
  canManage: boolean;
};

export async function getEmailTemplates(): Promise<EmailTemplatesData> {
  const templates = {
    client_invite: { ...EMAIL_TEMPLATE_DEFAULTS.client_invite },
    team_invite: { ...EMAIL_TEMPLATE_DEFAULTS.team_invite },
  };
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!ws || !userData.user) return { templates, canManage: false };

  const { data: rows } = await supabase
    .from("email_templates")
    .select("key, subject, message, button_label")
    .eq("workspace_id", ws.id);
  for (const r of rows ?? []) {
    const key = r.key as EmailTemplateKey;
    if (key in templates) {
      templates[key] = { subject: r.subject as string, message: r.message as string, button_label: r.button_label as string };
    }
  }
  const canManage = await isAdmin(supabase, ws.id, userData.user.id);
  return { templates, canManage };
}

export async function saveEmailTemplate(key: EmailTemplateKey, tpl: EmailTemplate) {
  if (!KEYS.includes(key)) return { error: "Unknown template" };
  const ws = await getCurrentWorkspace();
  if (!ws?.id) return { error: "No workspace" };
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !(await isAdmin(supabase, ws.id, userData.user.id))) {
    return { error: "Only admins can edit email templates." };
  }
  const row = {
    workspace_id: ws.id,
    key,
    subject: tpl.subject.slice(0, 200),
    message: tpl.message.slice(0, 2000),
    button_label: tpl.button_label.slice(0, 60),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("email_templates").upsert(row, { onConflict: "workspace_id,key" });
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function sendTestTemplate(key: EmailTemplateKey, tpl: EmailTemplate) {
  if (!KEYS.includes(key)) return { error: "Unknown template" };
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const to = userData.user?.email;
  if (!to) return { error: "No email on your account" };

  const meta = EMAIL_TEMPLATE_META.find((m) => m.key === key)!;
  const vars = { ...meta.sample };
  const href = `${APP_URL}/app`;
  const content = templatedEmail({
    subject: `[Test] ${fillEmailTemplate(tpl.subject, vars)}`,
    message: fillEmailTemplate(tpl.message, vars),
    buttonLabel: tpl.button_label,
    href,
  });
  try {
    await sendEmail({ to, ...content });
  } catch (e) {
    console.error("[email test] failed", e);
    return { error: "Could not send the test email." };
  }
  return { ok: true, sentTo: to };
}
