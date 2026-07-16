"use server";

import { createServerSupabase } from "@/lib/supabase/server";

// Best-effort: record (or refresh) that the current user viewed this mockup.
// Never throws into the caller.
export async function recordMockupView(mockupId: string): Promise<void> {
  try {
    const supabase = await createServerSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("mockup_views").upsert(
      { mockup_id: mockupId, user_id: userData.user.id, viewed_at: new Date().toISOString() },
      { onConflict: "mockup_id,user_id" },
    );
  } catch (e) {
    console.error("[view] record failed", e);
  }
}
