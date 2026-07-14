// Apply a SQL migration file to the cloud Supabase Postgres DB.
// Usage: node scripts/db-apply.mjs supabase/migrations/0001_xxx.sql
import { readFileSync } from "node:fs";
import { withClient } from "./_db.mjs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/db-apply.mjs <path-to-sql>");
  process.exit(2);
}
const sql = readFileSync(file, "utf8");

await withClient(async (client) => {
  await client.query(sql);
  console.log(`APPLIED: ${file}`);
});
