import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/crypto";

export async function workspaceSlackWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  workspaceId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("workspace_integrations")
    .select("slack_webhook_cipher, slack_webhook_iv")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data?.slack_webhook_cipher || !data?.slack_webhook_iv) return null;
  try {
    return decryptSecret(data.slack_webhook_cipher, data.slack_webhook_iv);
  } catch {
    return null;
  }
}

export async function postToSlack(webhook: string, payload: object): Promise<boolean> {
  try {
    const r = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch (e) {
    console.error("[slack] post failed", e);
    return false;
  }
}

function esc(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

export function commentSlackMessage(opts: { commenter: string; mockupName: string; body: string; href: string }) {
  const snippet = esc(opts.body).slice(0, 300) || "(no text)";
  return {
    text: `${opts.commenter} commented on ${opts.mockupName}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `:speech_balloon: *${esc(opts.commenter)}* commented on *${esc(opts.mockupName)}*` },
      },
      { type: "section", text: { type: "mrkdwn", text: `>${snippet}` } },
      {
        type: "actions",
        elements: [{ type: "button", text: { type: "plain_text", text: "View & reply" }, url: opts.href }],
      },
    ],
  };
}
