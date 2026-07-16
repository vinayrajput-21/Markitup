import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceStats, signCovers, type ProjectStats } from "@/app/app/dashboard-data";
import { ProjectCard } from "@/components/app/ProjectCard";
import { ProjectCardMenu } from "@/components/app/ProjectCardMenu";

type Row = { id: string; name: string; created_at: string; folder_id: string | null; mockups: { file_path: string; created_at: string }[] };

export default async function FolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params;
  const supabase = await createServerSupabase();
  const { data: folder } = await supabase.from("folders").select("id, name, workspace_id").eq("id", folderId).maybeSingle();
  if (!folder) notFound();

  const { data: allFolders } = await supabase.from("folders").select("id, name").eq("workspace_id", folder.workspace_id).order("name");
  const { data: projectData } = await supabase
    .from("projects")
    .select("id, name, created_at, folder_id, mockups(file_path, created_at)")
    .eq("folder_id", folderId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const projects = (projectData ?? []) as Row[];
  const stats = await getWorkspaceStats(supabase, projects.map((p) => p.id));
  const covers = await signCovers(supabase, projects.map((p) => [...p.mockups].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.file_path).filter(Boolean) as string[]);
  const zero: ProjectStats = { mockups: 0, comments: 0, resolved: 0 };
  const folderList = (allFolders ?? []) as { id: string; name: string }[];

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/app" className="text-muted hover:text-ink">Dashboard</Link>
        <span className="text-faint">/</span>
        <span className="font-semibold text-ink">{folder.name}</span>
      </div>
      {projects.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">This folder is empty</h3>
          <p className="mt-1 text-sm text-muted">Move a project here from the dashboard's project menu.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <ProjectCard
                id={p.id}
                name={p.name}
                coverUrl={covers.get([...p.mockups].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.file_path ?? "")}
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
