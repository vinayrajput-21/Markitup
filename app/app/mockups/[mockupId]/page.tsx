import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMockupSignedUrl } from "@/app/app/projects/[projectId]/actions";
import { MockupViewer, type ViewerPin } from "@/components/viewer/MockupViewer";
import { ShareDialog } from "@/components/viewer/ShareDialog";
import { emailLocalPart } from "@/lib/format";

export default async function MockupPage({
  params,
}: {
  params: Promise<{ mockupId: string }>;
}) {
  const { mockupId } = await params;
  const supabase = await createServerSupabase();

  const { data: mockup } = await supabase
    .from("mockups")
    .select("id, name, file_path, type, project_id, projects(name, workspace_id)")
    .eq("id", mockupId)
    .maybeSingle();
  if (!mockup) notFound();

  const { data: siblings } = await supabase
    .from("mockups")
    .select("id")
    .eq("project_id", mockup.project_id)
    .order("created_at", { ascending: true });

  // people who can be @mentioned: workspace team + project reviewers/editors
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (mockup as any).projects?.workspace_id as string | undefined;
  const [{ data: wm }, { data: pm }] = await Promise.all([
    supabase.from("workspace_members").select("profiles(id, name)").eq("workspace_id", workspaceId ?? ""),
    supabase.from("project_members").select("profiles(id, name)").eq("project_id", mockup.project_id),
  ]);
  const memberMap = new Map<string, { id: string; name: string }>();
  for (const row of [...(wm ?? []), ...(pm ?? [])]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (row as any).profiles;
    if (p?.id && p?.name) memberMap.set(p.id, { id: p.id, name: p.name });
  }
  const members = [...memberMap.values()];

  const { data: pins } = await supabase
    .from("pins")
    .select("id, x, y, number, status, comments(id, body, parent_comment_id, created_at, profiles(name, email))")
    .eq("mockup_id", mockupId)
    .order("number", { ascending: true });

  const { data: authData } = await supabase.auth.getUser();
  const currentUserName =
    (authData.user?.user_metadata?.name as string) ||
    emailLocalPart(authData.user?.email ?? "") ||
    "You";

  const url = await getMockupSignedUrl(mockup.file_path);

  const viewerPins: ViewerPin[] = (pins ?? []).map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    number: p.number,
    status: p.status,
    // Supabase's untyped client infers nested one-to-many joins loosely (e.g. profiles as an
    // array); `any` here matches the query's actual runtime shape without hand-maintaining a
    // brittle structural type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    comments: (p.comments ?? []).map((c: any) => ({
      id: c.id,
      body: c.body,
      parentCommentId: c.parent_comment_id,
      createdAt: c.created_at,
      authorName: c.profiles?.name || emailLocalPart(c.profiles?.email ?? "") || "Unknown",
    })),
  }));

  const resolved = viewerPins.filter((p) => p.status === "resolved").length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectName = (mockup as any).projects?.name as string | undefined;

  return (
    <div className="flex h-full flex-col">
      {/* top bar */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b bg-surface px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/app/projects/${mockup.project_id}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-brand-soft hover:text-brand-ink"
            aria-label="Back to project"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-ink">{mockup.name}</h1>
            <p className="truncate text-xs text-faint">
              {projectName ? `${projectName} · ` : ""}
              <span className="font-mono uppercase">{mockup.type}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-xs text-faint sm:inline">
            {resolved}/{viewerPins.length} resolved
          </span>
          <ShareDialog mockupId={mockupId} />
        </div>
      </header>

      {/* viewer */}
      <div className="min-h-0 flex-1">
        {url ? (
          <MockupViewer
            mockupId={mockupId}
            imageUrl={url}
            imageName={mockup.name}
            initialPins={viewerPins}
            siblings={siblings ?? [{ id: mockupId }]}
            members={members}
            currentUserName={currentUserName}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-faint">
            Could not load this mockup.
          </div>
        )}
      </div>
    </div>
  );
}
