import "server-only";
import pg from "pg";

// The cron runs without a user session, so it needs to reach the DB directly
// (bypassing RLS via the postgres role) through the IPv4 session pooler.
// Prefer SUPABASE_POOLER_URL; otherwise derive it from SUPABASE_DB_URL.
export function poolerUrl(): string | null {
  if (process.env.SUPABASE_POOLER_URL) return process.env.SUPABASE_POOLER_URL;
  const raw = process.env.SUPABASE_DB_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const ref = u.hostname.replace(/^db\./, "").split(".")[0];
    const region = process.env.SUPABASE_POOLER_REGION || "aws-1-ap-south-1";
    return `postgresql://postgres.${ref}:${u.password}@${region}.pooler.supabase.com:5432/postgres`;
  } catch {
    return null;
  }
}

export async function withPooler<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const url = poolerUrl();
  if (!url) throw new Error("No pooler connection configured (set SUPABASE_POOLER_URL or SUPABASE_DB_URL)");
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
