import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/app/app/actions";
import { timeAgo } from "@/lib/format";
import { UnarchiveButton } from "@/components/app/UnarchiveButton";

export default async function ArchivePage() {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("projects")
    .select("id, name, archived_at")
    .eq("workspace_id", ws?.id ?? "")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  const projects = (data ?? []) as { id: string; name: string; archived_at: string }[];

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Archive</h1>
      <p className="mt-1 text-sm text-muted">Archived projects are hidden from the dashboard. Restore any to bring it back.</p>
      {projects.length === 0 ? (
        <div className="card mt-6 grid place-items-center px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">Nothing archived</h3>
        </div>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border bg-surface">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{p.name}</span>
                <span className="font-mono text-xs text-faint">archived {timeAgo(p.archived_at)}</span>
              </span>
              <UnarchiveButton projectId={p.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
