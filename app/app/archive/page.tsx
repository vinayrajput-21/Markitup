import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/app/app/actions";
import { timeAgo } from "@/lib/format";
import { UnarchiveButton } from "@/components/app/UnarchiveButton";
import { MockupRestoreButton } from "@/components/app/MockupRestoreButton";

export default async function ArchivePage() {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();

  const [{ data: projectData }, { data: mockupData }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, archived_at")
      .eq("workspace_id", ws?.id ?? "")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false }),
    supabase
      .from("mockups")
      .select("id, name, archived_at, project_id, projects!inner(name, workspace_id)")
      .eq("projects.workspace_id", ws?.id ?? "")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false }),
  ]);

  const projects = (projectData ?? []) as { id: string; name: string; archived_at: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockups = (mockupData ?? []) as any[];
  const nothing = projects.length === 0 && mockups.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Archive</h1>
      <p className="mt-1 text-sm text-muted">Archived items are hidden from the app. Restore any to bring it back.</p>

      {nothing ? (
        <div className="card mt-6 grid place-items-center px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">Nothing archived</h3>
        </div>
      ) : (
        <>
          {projects.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">Projects</h2>
              <ul className="divide-y rounded-lg border bg-surface">
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
            </section>
          )}

          {mockups.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">Files</h2>
              <ul className="divide-y rounded-lg border bg-surface">
                {mockups.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{m.name}</span>
                      <span className="font-mono text-xs text-faint">
                        in{" "}
                        <Link href={`/app/projects/${m.project_id}`} className="text-brand hover:underline">
                          {m.projects?.name ?? "project"}
                        </Link>{" "}
                        · archived {timeAgo(m.archived_at)}
                      </span>
                    </span>
                    <MockupRestoreButton mockupId={m.id} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
