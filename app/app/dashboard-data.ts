import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectStats = { mockups: number; comments: number; resolved: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getWorkspaceStats(supabase: SupabaseClient<any>, projectIds: string[]) {
  const map = new Map<string, ProjectStats>();
  await Promise.all(
    projectIds.map(async (id) => {
      const { data } = await supabase.rpc("project_stats", { p: id });
      const row = Array.isArray(data) ? data[0] : data;
      map.set(id, {
        mockups: row?.mockups ?? 0,
        comments: row?.comments ?? 0,
        resolved: row?.resolved ?? 0,
      });
    }),
  );
  return map;
}

export async function signCovers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  covers: string[],
) {
  const signed = new Map<string, string>();
  const paths = covers.filter(Boolean);
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("mockups").createSignedUrls(paths, 60 * 60);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signed.set(u.path, u.signedUrl);
  }
  return signed;
}
