import { getResend } from "./client";

export const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

// Best-effort send. Returns { ok } and never throws — email problems must not
// break the Server Action that triggered them.
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean }> {
  const resend = getResend();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set; skipping "${opts.subject}"`);
    return { ok: false };
  }
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) {
      console.error("[email] send failed", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] send threw", e);
    return { ok: false };
  }
}
