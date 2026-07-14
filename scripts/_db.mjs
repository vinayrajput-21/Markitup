// Shared cloud-DB connection helper for applying migrations and running
// verification queries against the Supabase Postgres instance over its direct
// (IPv6) connection. Reads SUPABASE_DB_URL from .env.local. No Docker required.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

function loadEnv() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  let text = "";
  try {
    text = readFileSync(join(root, ".env.local"), "utf8");
  } catch {
    // fall back to process.env only
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

export async function withClient(fn) {
  loadEnv();
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("SUPABASE_DB_URL not set (expected in .env.local)");
    process.exit(2);
  }
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
