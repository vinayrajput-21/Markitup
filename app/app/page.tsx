import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace, createProject } from "./actions";
import { getWorkspaceStats, signCovers, type ProjectStats } from "./dashboard-data";
import { plural, emailLocalPart } from "@/lib/format";
import { ProjectCard } from "@/components/app/ProjectCard";
import { ProjectCardMenu } from "@/components/app/ProjectCardMenu";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { NotificationBell } from "@/components/app/NotificationBell";
import { ProfileMenu } from "@/components/app/ProfileMenu";

type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  archived_at: string | null;
  mockups: { id: string; file_path: string; created_at: string }[];
};

export default async function DashboardPage() {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const userEmail = authData.user?.email ?? "";
  const userName = (authData.user?.user_metadata?.name as string) || emailLocalPart(userEmail) || "";

  const { data: projectData } = await supabase
    .from("projects")
    .select("id, name, created_at, archived_at, mockups(id, file_path, created_at)")
    .eq("workspace_id", ws?.id ?? "")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const projects = (projectData ?? []) as ProjectRow[];
  const stats = await getWorkspaceStats(supabase, projects.map((p) => p.id));
  const covers = await signCovers(
    supabase,
    projects.map((p) => [...p.mockups].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.file_path).filter(Boolean) as string[],
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
          <p className="mt-1 text-sm text-muted">{ws?.name} · {plural(projects.length, "project")}</p>
        </div>
        <div className="flex items-center gap-2">
          <form action={async (formData: FormData) => { "use server"; await createProject(formData); }} className="flex items-center gap-2">
            <input name="name" placeholder="New project…" required className="field h-10 w-44" />
            <SubmitButton pendingLabel="Creating…" className="btn-primary btn-sm">New project</SubmitButton>
          </form>
          <Link href="/app/members" className="btn-secondary btn-sm">Invite</Link>
          <NotificationBell />
          <ProfileMenu name={userName} email={userEmail} />
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rise-in card grid place-items-center px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No projects yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted">Create a project above, upload a mockup, and start collecting pinned feedback.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <ProjectCard
                id={p.id}
                name={p.name}
                coverUrl={coverFor(p)}
                updatedAt={p.created_at}
                stats={stats.get(p.id) ?? zero}
                menu={<ProjectCardMenu projectId={p.id} name={p.name} />}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
