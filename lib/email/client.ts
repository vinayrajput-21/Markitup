import { Resend } from "resend";

let cached: Resend | null = null;

// Returns a Resend client, or null when no API key is configured (local/dev/test).
// Callers must treat null as "email disabled", not an error.
export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}
