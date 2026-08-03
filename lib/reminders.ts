// Shared reminder helpers (safe for client + server: no server-only imports).

export type ReminderVars = { page_name: string; sender: string; type: string; project: string };

export function fillTemplate(s: string, v: Partial<ReminderVars>): string {
  return s
    .replace(/\{\{\s*page_name\s*\}\}/g, v.page_name ?? "")
    .replace(/\{\{\s*sender\s*\}\}/g, v.sender ?? "")
    .replace(/\{\{\s*type\s*\}\}/g, v.type ?? "")
    .replace(/\{\{\s*project\s*\}\}/g, v.project ?? "");
}

export type ReminderSettings = {
  enabled: boolean;
  days_between: number;
  max_count: number;
  stop_on_feedback: boolean;
  weekdays_only: boolean;
  cc_me: boolean;
  notify_never: boolean;
  subject: string;
  message: string;
  button_label: string;
};

export const REMINDER_DEFAULTS: ReminderSettings = {
  enabled: false,
  days_between: 3,
  max_count: 3,
  stop_on_feedback: true,
  weekdays_only: true,
  cc_me: false,
  notify_never: true,
  subject: 'Any thoughts on "{{page_name}}"?',
  message:
    'Just checking in — {{sender}} shared "{{page_name}}" with you and would love your feedback. It only takes a minute to add your comments.',
  button_label: "Leave feedback",
};

export const REMINDER_PLACEHOLDERS = ["page_name", "project", "type", "sender"] as const;
