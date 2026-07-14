// Run a read-only verification query against the cloud Supabase Postgres DB
// and print rows as JSON. Usage: node scripts/db-query.mjs "select ..."
import { withClient } from "./_db.mjs";

const sql = process.argv[2];
if (!sql) {
  console.error('usage: node scripts/db-query.mjs "<sql>"');
  process.exit(2);
}

await withClient(async (client) => {
  const res = await client.query(sql);
  console.log(JSON.stringify(res.rows, null, 2));
});
