// Seeds already-confirmed auth users directly in the cloud Supabase Postgres
// DB (bypassing the UI signup flow, which requires email confirmation on
// this project). Reuses the same `withClient` helper the migration/verify
// scripts use, so it reads SUPABASE_DB_URL from .env.local automatically.
//
// Playwright transpiles this file to CommonJS (no "type": "module" in
// package.json), so a static `import` of the .mjs helper would be rewritten
// to `require()` and fail with "Cannot use import.meta outside a module".
// A dynamic `import()` stays a real ESM import at runtime and loads fine.
async function loadDb() {
  const mod = await import("../scripts/_db.mjs");
  return mod.withClient as <T>(fn: (client: import("pg").Client) => Promise<T>) => Promise<T>;
}

/**
 * Insert a confirmed auth user. The `on_auth_user_created` trigger
 * (supabase/migrations/0001_profiles_workspaces.sql) fires on insert into
 * auth.users and auto-creates the matching public.profiles row.
 * Returns the new user's id.
 */
export async function seedUser(email: string, password: string, name: string): Promise<string> {
  const withClient = await loadDb();
  return withClient(async (client) => {
    // GoTrue (Supabase Auth) scans confirmation_token/recovery_token/
    // email_change_token_new/email_change into non-nullable string fields.
    // Leaving them NULL (the column default) makes every subsequent
    // GoTrue query against the row fail with "Database error querying
    // schema" — so they must be explicitly set to '' here, not left unset.
    const res = await client.query(
      `insert into auth.users
         (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
          raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
       values
         (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          $1, extensions.crypt($2, extensions.gen_salt('bf')), now(), now(), now(),
          jsonb_build_object('name', $3::text), '', '', '', '')
       returning id`,
      [email, password, name],
    );
    return res.rows[0].id as string;
  });
}

/**
 * Delete seeded users by email, cleaning up everything the test created.
 *
 * NOTE: only `workspace_id`/`project_id`/`mockup_id`/`pin_id` FKs cascade
 * (supabase/migrations 0001-0004). The `created_by`/`author_id`/`invited_by`
 * FKs to `profiles(id)` deliberately do NOT cascade (they preserve
 * attribution), so a plain `delete from auth.users` fails with a foreign key
 * violation as soon as a seeded user has created a project/mockup/pin/
 * comment. Deleting owned workspaces FIRST cascades away everything
 * downstream (projects -> mockups -> pins -> comments -> workspace_members ->
 * invitations, all via `workspace_id`/`project_id`/... on delete cascade),
 * so by the time we delete the auth.users rows there is nothing left
 * referencing their profile via a non-cascading FK.
 * Storage objects in the `mockups` bucket are NOT removed by this
 * (acceptable for test cleanup).
 */
export async function cleanupUsers(emails: string[]): Promise<void> {
  if (emails.length === 0) return;
  const withClient = await loadDb();
  await withClient(async (client) => {
    await client.query(
      `delete from public.workspaces
       where owner_id in (select id from auth.users where email = any($1))`,
      [emails],
    );
    await client.query(`delete from auth.users where email = any($1)`, [emails]);
  });
}
