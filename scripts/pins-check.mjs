// Integration test for the per-mockup sequential pin-numbering trigger
// (assign_pin_number / set_pin_number, from supabase/migrations/0004_pins_comments.sql).
//
// Modeled on scripts/rls-check.mjs: connects as the `postgres` superuser via
// withClient (SUPABASE_DB_URL), does all setup + assertions inside ONE
// transaction, and ROLLS BACK at the end so the DB is left unchanged.
//
// We do NOT have a valid service_role key, so unlike the brief's vitest
// version (which uses a service_role Supabase client + auth.admin.createUser)
// this seeds a real auth.users row directly over the postgres connection.
// The signup trigger (handle_new_user, from 0001) auto-creates the matching
// profiles row. The numbering trigger fires regardless of which role performs
// the insert, so running the pin inserts as postgres (RLS bypassed) still
// faithfully exercises the trigger under test -- RLS itself is verified
// separately in scripts/rls-check.mjs / the db-query RLS check for this task.
//
// Assertions:
//   1. Inserting 3 pins into mockupA (without setting `number`) yields
//      numbers [1, 2, 3].
//   2. Inserting 2 pins into mockupB yields numbers [1, 2] -- proving
//      numbering is scoped PER-MOCKUP, not global across all pins.
//
// Usage: node scripts/pins-check.mjs
import { randomUUID } from "node:crypto";
import { withClient } from "./_db.mjs";

let failures = 0;

function pass(label) {
  console.log(`PASS: ${label}`);
}
function fail(label, detail) {
  failures++;
  console.log(`FAIL: ${label}${detail ? ` -- ${detail}` : ""}`);
}

async function main() {
  await withClient(async (client) => {
    await client.query("begin");
    try {
      // --- Setup: seed a real auth user (signup trigger auto-creates the
      // profile), then a workspace / project / two mockups, all as postgres. ---
      const email = `pins-check-${Date.now()}@example.com`;
      const userRes = await client.query(
        `insert into auth.users
           (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
         values
           (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1, '', now(), now())
         returning id`,
        [email]
      );
      const userId = userRes.rows[0].id;
      console.log(`seeded user=${userId}`);

      const wsId = randomUUID();
      await client.query(
        "insert into public.workspaces (id, name, owner_id) values ($1, $2, $3)",
        [wsId, "Pins Check WS", userId]
      );

      const projId = randomUUID();
      await client.query(
        "insert into public.projects (id, workspace_id, name, created_by) values ($1, $2, $3, $4)",
        [projId, wsId, "Pins Check Project", userId]
      );

      const mockupAId = randomUUID();
      const mockupBId = randomUUID();
      await client.query(
        "insert into public.mockups (id, project_id, name, file_path, created_by) values ($1, $2, $3, $4, $5)",
        [mockupAId, projId, "Mockup A", "x/a.png", userId]
      );
      await client.query(
        "insert into public.mockups (id, project_id, name, file_path, created_by) values ($1, $2, $3, $4, $5)",
        [mockupBId, projId, "Mockup B", "x/b.png", userId]
      );
      console.log(`seeded mockupA=${mockupAId} mockupB=${mockupBId}`);

      // --- Assertion 1: 3 pins into mockupA are numbered [1, 2, 3] ---
      const numsA = [];
      for (let i = 0; i < 3; i++) {
        const res = await client.query(
          "insert into public.pins (mockup_id, x, y, created_by) values ($1, $2, $3, $4) returning number",
          [mockupAId, 0.1 * i, 0.2, userId]
        );
        numsA.push(res.rows[0].number);
      }
      if (JSON.stringify(numsA) === JSON.stringify([1, 2, 3])) {
        pass(`mockupA pins numbered [1,2,3] (got ${JSON.stringify(numsA)})`);
      } else {
        fail("mockupA pins numbered [1,2,3]", `got ${JSON.stringify(numsA)}`);
      }

      // --- Assertion 2: 2 pins into mockupB are numbered [1, 2] (per-mockup, not global) ---
      const numsB = [];
      for (let i = 0; i < 2; i++) {
        const res = await client.query(
          "insert into public.pins (mockup_id, x, y, created_by) values ($1, $2, $3, $4) returning number",
          [mockupBId, 0.1 * i, 0.3, userId]
        );
        numsB.push(res.rows[0].number);
      }
      if (JSON.stringify(numsB) === JSON.stringify([1, 2])) {
        pass(`mockupB pins numbered [1,2] -- per-mockup numbering confirmed (got ${JSON.stringify(numsB)})`);
      } else {
        fail("mockupB pins numbered [1,2] (per-mockup numbering)", `got ${JSON.stringify(numsB)}`);
      }
    } finally {
      // Always roll back, leaving the DB unchanged.
      await client.query("rollback");
    }
  });

  if (failures > 0) {
    console.log(`\n${failures} assertion(s) FAILED`);
    process.exit(1);
  } else {
    console.log("\nAll assertions PASSED");
  }
}

main().catch((err) => {
  console.error("pins-check crashed:", err);
  process.exit(2);
});
