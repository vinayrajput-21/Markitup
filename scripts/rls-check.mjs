// Runtime RLS test for the workspace_members "self join via owner insert"
// policy. Exercises the policies as the `authenticated` Postgres role with a
// simulated user JWT (via request.jwt.claims + `set local role authenticated`)
// -- NOT as the postgres superuser and NOT via the service-role admin API.
//
// Everything runs inside a single transaction that is ROLLED BACK at the end,
// so the database is left unchanged regardless of outcome.
//
// Assertion 1 (bootstrap must SUCCEED): a brand-new workspace owner, who is
// not yet a workspace_members row, must be able to insert their own 'owner'
// membership immediately after creating the workspace.
//
// Assertion 2 (self-join must be DENIED): an unrelated user (attacker) must
// NOT be able to insert themselves into someone else's workspace.
//
// Assertion 3 (owner RETURNING must SUCCEED): the "members read workspace"
// SELECT policy now also allows owner_id = auth.uid(), so a brand-new
// owner's `insert ... returning id` on `workspaces` must return their own
// row immediately, even before they have a workspace_members row. This is
// what Task 5's bootstrap (`insert into workspaces(...).select().single()`)
// relies on.
//
// Usage: node scripts/rls-check.mjs
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

async function actAs(client, userId) {
  // Go back to postgres first so we're allowed to reconfigure claims / role.
  await client.query("reset role");
  await client.query(
    "select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)",
    [userId]
  );
  await client.query("set local role authenticated");
}

async function main() {
  await withClient(async (client) => {
    await client.query("begin");
    try {
      // --- Setup: seed two real auth users as postgres (signup trigger
      // auto-creates their profiles rows). ---
      const ownerEmail = `rls-owner-${Date.now()}@example.com`;
      const attackerEmail = `rls-attacker-${Date.now()}@example.com`;

      const ownerRes = await client.query(
        `insert into auth.users
           (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
         values
           (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1, '', now(), now())
         returning id`,
        [ownerEmail]
      );
      const ownerId = ownerRes.rows[0].id;

      const attackerRes = await client.query(
        `insert into auth.users
           (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
         values
           (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1, '', now(), now())
         returning id`,
        [attackerEmail]
      );
      const attackerId = attackerRes.rows[0].id;

      console.log(`seeded owner=${ownerId} attacker=${attackerId}`);

      // --- Assertion 1: bootstrap insert must succeed as OWNER ---
      // Wrapped in a SAVEPOINT: Postgres aborts the whole transaction after
      // any failed statement, so if this assertion unexpectedly fails we
      // roll back to the savepoint to keep the transaction usable for
      // assertion 2 and the final cleanup.
      const wsId = randomUUID();
      let bootstrapOk = false;
      await client.query("savepoint sp1");
      try {
        await actAs(client, ownerId);

        await client.query(
          "insert into public.workspaces (id, name, owner_id) values ($1, $2, $3)",
          [wsId, "T", ownerId]
        );

        await client.query(
          "insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, 'owner')",
          [wsId, ownerId]
        );

        bootstrapOk = true;
        pass("bootstrap: owner can create workspace and self-insert as owner member");
      } catch (err) {
        await client.query("rollback to savepoint sp1");
        fail(
          "bootstrap: owner can create workspace and self-insert as owner member",
          err.message
        );
      }

      // If the bootstrap failed, the workspace row was rolled back along with
      // it. Re-create it as postgres (bypassing RLS) purely so assertion 2
      // still has a real workspace to target -- it tests a different policy
      // branch and shouldn't be starved by assertion 1's outcome.
      if (!bootstrapOk) {
        await client.query("reset role");
        await client.query(
          "insert into public.workspaces (id, name, owner_id) values ($1, $2, $3)",
          [wsId, "T", ownerId]
        );
      }

      // --- Assertion 2: self-join by an unrelated user must be DENIED ---
      await client.query("savepoint sp2");
      try {
        await actAs(client, attackerId);

        await client.query(
          "insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, 'owner')",
          [wsId, attackerId]
        );

        // If we get here, the insert succeeded -- that's a FAILURE.
        await client.query("rollback to savepoint sp2");
        fail(
          "isolation: attacker cannot self-join another user's workspace",
          "insert unexpectedly SUCCEEDED -- tenant isolation is broken"
        );
      } catch (err) {
        await client.query("rollback to savepoint sp2").catch(() => {});
        const msg = String(err.message || "");
        if (/row-level security policy/i.test(msg)) {
          pass("isolation: attacker cannot self-join another user's workspace");
        } else {
          fail(
            "isolation: attacker cannot self-join another user's workspace",
            `unexpected error: ${msg}`
          );
        }
      }

      // --- Assertion 3: owner can read their own brand-new workspace via
      // INSERT ... RETURNING (needed by Task 5's bootstrap) ---
      await client.query("savepoint sp3");
      try {
        await actAs(client, ownerId);

        const res = await client.query(
          "insert into public.workspaces (name, owner_id) values ($1, $2) returning id",
          ["T2", ownerId]
        );

        if (res.rows.length === 1) {
          pass("bootstrap: owner can SELECT their own just-created workspace via RETURNING");
        } else {
          await client.query("rollback to savepoint sp3");
          fail(
            "bootstrap: owner can SELECT their own just-created workspace via RETURNING",
            `expected 1 row, got ${res.rows.length}`
          );
        }
      } catch (err) {
        await client.query("rollback to savepoint sp3").catch(() => {});
        fail(
          "bootstrap: owner can SELECT their own just-created workspace via RETURNING",
          err.message
        );
      }
    } finally {
      // Always return to postgres and roll back, leaving the DB unchanged.
      await client.query("reset role").catch(() => {});
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
  console.error("rls-check crashed:", err);
  process.exit(2);
});
