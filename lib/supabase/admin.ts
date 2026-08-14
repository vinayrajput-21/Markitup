import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS, so it must NEVER be imported into client
// code (the `server-only` guard enforces that at build time). Used only to sign
// a shared mockup's storage URL for a logged-out visitor on a PUBLIC share link,
// after the token has already been validated as public via an RPC.
//
// Returns null if the service-role key isn't configured, so callers can fall
// back gracefully instead of crashing.
export function createAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
