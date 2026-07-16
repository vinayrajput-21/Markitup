import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace, createProject } from "./actions";
import { getWorkspaceStats, signCovers, type ProjectStats } from "./dashboard-data";
import { plural, emailLocalPart } from "@/lib/format";
import { ProjectCard } from "@/components/app/ProjectCard";
import { ProjectCardMenu } from "@/components/app/ProjectCardMenu";
import { NewFolderButton } from "@/components/app/NewFolderButton";
import { NotificationBell } from "@/components/app/NotificationBell";
import { ProfileMenu } from "@/components/app/ProfileMenu";

type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  folder_id: string | null;
  archived_at: string | null;
  mockups: { id: string; file_path: string; created_at: string }[];
};

export default async function DashboardPage() {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const userEmail = authData.user?.email ?? "";
  const userName = (authData.user?.user_metadata?.name as string) || emailLocalPart(userEmail) || "";

  const [{ data: folders }, { data: projectData }] = await Promise.all([
    supabase.from("folders").select("id, name").eq("workspace_id", ws?.id ?? "").order("name"),
    supabase
      .from("projects")
      .select("id, name, created_at, folder_id, archived_at, mockups(id, file_path, created_at)")
      .eq("workspace_id", ws?.id ?? "")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const allProjects = (projectData ?? []) as ProjectRow[];
  const looseProjects = allProjects.filter((p) => !p.folder_id);
  const folderList = (folders ?? []) as { id: string; name: string }[];
  const projectCountByFolder = new Map<string, number>();
  for (const p of allProjects) if (p.folder_id) projectCountByFolder.set(p.folder_id, (projectCountByFolder.get(p.folder_id) ?? 0) + 1);

  const stats = await getWorkspaceStats(supabase, looseProjects.map((p) => p.id));
  const covers = await signCovers(
    supabase,
    looseProjects.map((p) => [...p.mockups].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.file_path).filter(Boolean) as string[],
  );

  function coverFor(p: ProjectRow) {
    const latest = [...p.mockups].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return latest ? covers.get(latest.file_path) : undefined;
  }
  const zero: ProjectStats = { mockups: 0, comments: 0, resolved: 0 };

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">{ws?.name} · {plural(allProjects.length, "project")}</p>
        </div>
        <div className="flex items-center gap-2">
          <NewFolderButton />
          <form action={async (formData: FormData) => { "use server"; await createProject(formData); }} className="flex items-center gap-2">
            <input name="name" placeholder="New project…" required className="field h-10 w-44" />
            <button className="btn-primary btn-sm">New project</button>
          </form>
          <Link href="/app/members" className="btn-secondary btn-sm">Invite</Link>
          <NotificationBell />
          <ProfileMenu name={userName} email={userEmail} />
        </div>
      </div>

      {folderList.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-muted">Folders</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {folderList.map((f) => (
              <li key={f.id}>
                <Link href={`/app/folders/${f.id}`} className="card card-hover flex items-center gap-3 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{f.name}</span>
                    <span className="text-xs text-faint">{plural(projectCountByFolder.get(f.id) ?? 0, "project")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-muted">Projects</h2>
      {looseProjects.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No projects here</h3>
          <p className="mt-1 max-w-sm text-sm text-muted">Create a project above, or open a folder.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {looseProjects.map((p) => (
            <li key={p.id}>
              <ProjectCard
                id={p.id}
                name={p.name}
                coverUrl={coverFor(p)}
                updatedAt={p.created_at}
                stats={stats.get(p.id) ?? zero}
                menu={<ProjectCardMenu projectId={p.id} folders={folderList} currentFolderId={p.folder_id} />}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
