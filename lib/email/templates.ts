const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://markitup-woad.vercel.app";

function layout(heading: string, bodyHtml: string, cta?: { label: string; href: string }) {
  const button = cta
    ? `<a href="${cta.href}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;margin-top:16px">${cta.label}</a>`
    : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
    <div style="font-weight:700;font-size:18px;margin-bottom:16px">MarkUp</div>
    <h1 style="font-size:18px;margin:0 0 12px">${esc(heading)}</h1>
    ${bodyHtml}
    ${button}
    <p style="color:#9ca3af;font-size:12px;margin-top:28px">Apexure · Visual review, done right.</p>
  </div>`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function commentNotification(opts: {
  recipientName: string;
  commenterName: string;
  mockupName: string;
  body: string;
  mockupId: string;
}) {
  const href = `${APP_URL}/app/mockups/${opts.mockupId}`;
  const subject = `New comment on ${opts.mockupName}`;
  const html = layout(
    subject,
    `<p style="margin:0 0 8px"><strong>${esc(opts.commenterName)}</strong> commented:</p>
     <blockquote style="margin:0;padding:10px 14px;background:#f3f4f6;border-radius:8px;font-size:14px">${esc(opts.body)}</blockquote>`,
    { label: "View comment", href },
  );
  const text = `${opts.commenterName} commented on ${opts.mockupName}:\n\n${opts.body}\n\n${href}`;
  return { subject, html, text };
}

export function invitation(opts: {
  inviterName: string;
  workspaceName: string;
  isNewUser: boolean;
}) {
  const href = opts.isNewUser ? `${APP_URL}/signup` : `${APP_URL}/login`;
  const subject = `${opts.inviterName} invited you to ${opts.workspaceName}`;
  const html = layout(
    subject,
    `<p style="margin:0;font-size:14px"><strong>${esc(opts.inviterName)}</strong> invited you to collaborate in <strong>${esc(opts.workspaceName)}</strong> on MarkUp — upload mockups, drop pins, and review designs together.</p>`,
    { label: opts.isNewUser ? "Create your account" : "Open MarkUp", href },
  );
  const text = `${opts.inviterName} invited you to ${opts.workspaceName} on MarkUp.\n\n${href}`;
  return { subject, html, text };
}

export function welcome(opts: { name: string }) {
  const href = `${APP_URL}/app`;
  const subject = "Welcome to MarkUp";
  const html = layout(
    `Welcome, ${opts.name}!`,
    `<p style="margin:0;font-size:14px">Your workspace is ready. Create a project, upload a mockup, and share a link to start collecting pinned feedback.</p>`,
    { label: "Go to your workspace", href },
  );
  const text = `Welcome to MarkUp, ${opts.name}!\n\nGet started: ${href}`;
  return { subject, html, text };
}
