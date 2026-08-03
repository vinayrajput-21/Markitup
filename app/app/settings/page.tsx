import { getFigmaConnection } from "@/app/app/figma-actions";
import { getSlackConnection } from "@/app/app/slack-actions";
import { FigmaConnect } from "@/components/app/FigmaConnect";
import { SlackConnect } from "@/components/app/SlackConnect";
import { ThemeSettings } from "@/components/app/ThemeSettings";
import { RemindersSettings } from "@/components/app/RemindersSettings";
import { getReminderData } from "@/app/app/reminder-actions";

export default async function SettingsPage() {
  const [{ connected }, { connected: slackConnected }, { settings, schedules }] = await Promise.all([
    getFigmaConnection(),
    getSlackConnection(),
    getReminderData(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Appearance, reminders, integrations and connections.</p>
      </div>

      <h2 className="mb-3 text-xs font-semibold tracking-wider text-faint uppercase">Appearance</h2>
      <ThemeSettings />

      <div className="mt-9 mb-3">
        <h2 className="text-xs font-semibold tracking-wider text-faint uppercase">Client reminders</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Automatically follow up with clients until they leave feedback. Reminders only apply to mockups you send with
          <span className="font-medium text-ink"> Send to client</span> — a link you copy yourself won&apos;t trigger them.
        </p>
      </div>
      <RemindersSettings initial={settings} schedules={schedules} />

      <h2 className="mb-3 mt-9 text-xs font-semibold tracking-wider text-faint uppercase">Integrations</h2>
      <div className="space-y-4">
        <SlackConnect connected={slackConnected} />
        <FigmaConnect connected={connected} />
      </div>
    </div>
  );
}
