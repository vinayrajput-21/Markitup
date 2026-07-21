import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { UploadDropzone } from "@/components/viewer/UploadDropzone";
import { FigmaImport } from "@/components/viewer/FigmaImport";
import { timeAgo, plural } from "@/lib/format";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createServerSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();

  const { data: mockups } = await supabase
    .from("mockups")
    .select("id, name, file_path, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const rows = mockups ?? [];
  const signed = new Map<string, string>();
  if (rows.length) {
    const { data: urls } = await supabase.storage
      .from("mockups")
      .createSignedUrls(rows.map((m) => m.file_path), 60 * 60);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signed.set(u.path, u.signedUrl);
  }

  const { data: authData } = await supabase.auth.getUser();
  const meId = authData.user?.id ?? "";
  const ids = rows.map((m) => m.id);
  const viewedIds = new Set<string>();
  if (meId && ids.length) {
    const { data: views } = await supabase
      .from("mockup_views")
      .select("mockup_id")
      .eq("user_id", meId)
      .in("mockup_id", ids);
    for (const v of views ?? []) viewedIds.add(v.mockup_id as string);
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <Link
        href="/app"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-brand-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Projects
      </Link>

      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project?.name ?? "Project"}</h1>
          <p className="mt-1 text-sm text-muted">{plural(rows.length, "mockup")}</p>
        </div>
        {rows.length >= 2 && (
          <Link href={`/app/projects/${projectId}/compare`} className="btn-secondary btn-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="4" width="8" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
              <rect x="13" y="4" width="8" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
            </svg>
            Compare
          </Link>
        )}
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_22rem]">
        <UploadDropzone projectId={projectId} />
        <FigmaImport projectId={projectId} />
      </div>

      {rows.length > 0 && (
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((m) => (
            <li key={m.id}>
              <Link href={`/app/mockups/${m.id}`} className="card card-hover block overflow-hidden">
                <div className="relative aspect-[4/3] w-full overflow-hidden border-b bg-canvas">
                  {!viewedIds.has(m.id) && (
                    <span
                      className="absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white"
                      style={{ background: "var(--color-brand)" }}
                    >
                      New
                    </span>
                  )}
                  {signed.get(m.file_path) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={signed.get(m.file_path)} alt="" className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className="h-full w-full bg-brand-soft" />
                  )}
                </div>
                <div className="p-3">
                  <div className="truncate text-sm font-semibold text-ink">{m.name}</div>
                  <div className="mt-0.5 font-mono text-xs text-faint">{timeAgo(m.created_at)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
