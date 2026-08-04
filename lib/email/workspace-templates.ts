import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMAIL_TEMPLATE_DEFAULTS, fillEmailTemplate, type EmailTemplate, type EmailTemplateKey } from "@/lib/email-templates";
import { templatedEmail } from "@/lib/email/templates";

// Read a workspace's customized template for `key`, falling back to the default.
export async function loadEmailTemplate(
  supabase: SupabaseClient,
  workspaceId: string,
  key: EmailTemplateKey,
): Promise<EmailTemplate> {
  const { data } = await supabase
    .from("email_templates")
    .select("subject, message, button_label")
    .eq("workspace_id", workspaceId)
    .eq("key", key)
    .maybeSingle();
  return (data as EmailTemplate | null) ?? EMAIL_TEMPLATE_DEFAULTS[key];
}

// Load + fill + render a ready-to-send email ({subject, html, text}).
export async function renderWorkspaceEmail(
  supabase: SupabaseClient,
  workspaceId: string,
  key: EmailTemplateKey,
  vars: Record<string, string>,
  href: string,
) {
  const tpl = await loadEmailTemplate(supabase, workspaceId, key);
  return templatedEmail({
    subject: fillEmailTemplate(tpl.subject, vars),
    message: fillEmailTemplate(tpl.message, vars),
    buttonLabel: tpl.button_label,
    href,
  });
}
