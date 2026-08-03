-- Slack integration: store the workspace's incoming-webhook URL (encrypted)
-- alongside the existing Figma token on workspace_integrations.
alter table public.workspace_integrations
  add column slack_webhook_cipher text,
  add column slack_webhook_iv text;
