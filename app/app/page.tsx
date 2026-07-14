import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace, createProject } from "./actions";
import { timeAgo, plural } from "@/lib/format";

type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  mockups: { id: string; file_path: string; created_at: string }[];
};

function ProjectCover({ url, name }: { url?: string; name: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="h-full w-full object-cover object-top" />
    );
  }
  return (
    <div className="relative grid h-full w-full place-items-center bg-brand-soft">
      <span className="font-mono text-3xl font-bold text-brand/40">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="absolute left-4 top-4 h-3 w-3 rounded-full bg-brand/25" />
      <span className="absolute bottom-5 right-6 h-3 w-3 rounded-full bg-brand/20" />
    </div>
  );
}

export default async function ProjectsPage() {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("projects")
    .select("id, name, created_at, mockups(id, file_path, created_at)")
    .eq("workspace_id", ws?.id ?? "")
    .order("created_at", { ascending: false });

  const projects = (data ?? []) as ProjectRow[];

  // batch-sign one cover thumbnail per project (private bucket)
  const covers = projects
    .map((p) => [...p.mockups].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.file_path)
    .filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (covers.length) {
    const { data: urls } = await supabase.storage
      .from("mockups")
      .createSignedUrls(covers, 60 * 60);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signed.set(u.path, u.signedUrl);
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      {/* header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted">
            {ws?.name} · {plural(projects.length, "project")}
          </p>
        </div>
        <form
          action={async (formData: FormData) => {
            "use server";
            await createProject(formData);
          }}
          className="flex items-center gap-2"
        >
          <input
            name="name"
            placeholder="Name a new project…"
            required
            className="field h-10 w-56"
          />
          <button className="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            New project
          </button>
        </form>
      </div>

      {projects.length === 0 ? (
        <div className="card grid place-items-center px-6 py-20 text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-soft">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-brand" aria-hidden>
              <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
              <path d="M3 9h18" stroke="currentColor" strokeWidth="1.7" />
              <circle cx="14.5" cy="15" r="1.6" fill="currentColor" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">No projects yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Create a project, upload a mockup, and start collecting pinned feedback
            from your clients.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const latest = [...p.mockups].sort((a, b) =>
              b.created_at.localeCompare(a.created_at),
            )[0];
            const url = latest ? signed.get(latest.file_path) : undefined;
            return (
              <li key={p.id}>
                <Link
                  href={`/app/projects/${p.id}`}
                  className="card card-hover block overflow-hidden"
                >
                  <div className="aspect-[16/10] w-full overflow-hidden border-b bg-canvas">
                    <ProjectCover url={url} name={p.name} />
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-semibold text-ink">{p.name}</h3>
                    <div className="mt-2 flex items-center gap-3 text-xs text-faint">
                      <span className="inline-flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
                          <circle cx="8.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="m4 17 5-4 4 3 3-2 4 3" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                        </svg>
                        {plural(p.mockups.length, "mockup")}
                      </span>
                      <span className="font-mono">{timeAgo(p.created_at)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
