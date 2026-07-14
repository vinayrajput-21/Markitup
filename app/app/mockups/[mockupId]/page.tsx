import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMockupSignedUrl } from "@/app/app/projects/[projectId]/actions";
import { MockupViewer, type ViewerPin } from "@/components/viewer/MockupViewer";
import { CopyLinkButton } from "@/components/viewer/CopyLinkButton";

export default async function MockupPage({
  params,
}: {
  params: Promise<{ mockupId: string }>;
}) {
  const { mockupId } = await params;
  const supabase = await createServerSupabase();

  const { data: mockup } = await supabase
    .from("mockups")
    .select("id, name, file_path, type, project_id, projects(name)")
    .eq("id", mockupId)
    .maybeSingle();
  if (!mockup) notFound();

  const { data: pins } = await supabase
    .from("pins")
    .select("id, x, y, number, status, comments(id, body, parent_comment_id, created_at, profiles(name))")
    .eq("mockup_id", mockupId)
    .order("number", { ascending: true });

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
      authorName: c.profiles?.name ?? "Someone",
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
          <CopyLinkButton />
        </div>
      </header>

      {/* viewer */}
      <div className="min-h-0 flex-1">
        {url ? (
          <MockupViewer mockupId={mockupId} imageUrl={url} initialPins={viewerPins} />
        ) : (
          <div className="grid h-full place-items-center text-sm text-faint">
            Could not load this mockup.
          </div>
        )}
      </div>
    </div>
  );
}
