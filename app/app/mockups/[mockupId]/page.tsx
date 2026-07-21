import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMockupSignedUrl } from "@/app/app/projects/[projectId]/actions";
import { buildEmbedUrl } from "@/lib/figma";
import { MockupViewer, type ViewerPin } from "@/components/viewer/MockupViewer";
import { ShareDialog } from "@/components/viewer/ShareDialog";
import { ProfileMenu } from "@/components/app/ProfileMenu";
import { NotificationBell } from "@/components/app/NotificationBell";
import { RecentViewers, type Viewer } from "@/components/viewer/RecentViewers";
import { RecordView } from "@/components/viewer/RecordView";
import { emailLocalPart } from "@/lib/format";
import { sanitizeCommentHtml } from "@/lib/sanitize";

export default async function MockupPage({
  params,
}: {
  params: Promise<{ mockupId: string }>;
}) {
  const { mockupId } = await params;
  const supabase = await createServerSupabase();

  const { data: mockup } = await supabase
    .from("mockups")
    .select("id, name, file_path, type, project_id, figma_file_key, figma_node_id, projects(name, workspace_id)")
    .eq("id", mockupId)
    .maybeSingle();
  if (!mockup) notFound();

  const { data: siblings } = await supabase
    .from("mockups")
    .select("id")
    .eq("project_id", mockup.project_id)
    .is("archived_at", null)
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
    .select(
      "id, x, y, number, status, comments(id, body, parent_comment_id, created_at, profiles(name, email), comment_attachments(file_path, type, name))",
    )
    .eq("mockup_id", mockupId)
    .order("number", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachmentPaths = (pins ?? []).flatMap((p: any) =>
    (p.comments ?? []).flatMap((c: any) =>
      (c.comment_attachments ?? []).map((a: any) => a.file_path as string),
    ),
  );
  const signedAttachmentUrls = new Map<string, string>();
  if (attachmentPaths.length) {
    const { data: urls } = await supabase.storage
      .from("comment-files")
      .createSignedUrls(attachmentPaths, 3600);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signedAttachmentUrls.set(u.path, u.signedUrl);
  }

  const { data: viewRows } = await supabase
    .from("mockup_views")
    .select("viewed_at, profiles:user_id(id, name, email)")
    .eq("mockup_id", mockupId)
    .order("viewed_at", { ascending: false })
    .limit(8);
  const viewers: Viewer[] = (viewRows ?? []).map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (r as any).profiles;
    return { id: p?.id ?? "", name: p?.name || "Someone", email: p?.email ?? "", viewedAt: r.viewed_at as string };
  }).filter((v) => v.id);

  const { data: authData } = await supabase.auth.getUser();
  const currentUserName =
    (authData.user?.user_metadata?.name as string) ||
    emailLocalPart(authData.user?.email ?? "") ||
    "You";
  const currentUserEmail = authData.user?.email ?? "";

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
      // Sanitize at render time too: the comments table is directly writable via
      // RLS by any project member, so a raw body could bypass addComment's write-time
      // sanitize. Idempotent with it, and covers legacy/direct-insert rows.
      body: sanitizeCommentHtml((c.body as string) ?? ""),
      parentCommentId: c.parent_comment_id,
      createdAt: c.created_at,
      authorName: c.profiles?.name || emailLocalPart(c.profiles?.email ?? "") || "Unknown",
      attachments: (c.comment_attachments ?? []).map((a: any) => ({
        url: signedAttachmentUrls.get(a.file_path) ?? "",
        type: a.type,
        name: a.name,
      })),
    })),
  }));

  // Live Figma embed is shown ONLY to trusted workspace members. External
  // reviewers (share-link visitors / project-only members) get the static
  // rendered frame, so the Figma URL is never present in their page to inspect.
  const { data: isTeam } = workspaceId
    ? await supabase.rpc("is_workspace_member", { ws: workspaceId })
    : { data: false };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mk = mockup as any;
  const figmaEmbedUrl =
    mockup.type === "figma" && mk.figma_file_key && isTeam
      ? buildEmbedUrl(mk.figma_file_key as string, (mk.figma_node_id as string) ?? "")
      : null;

  const titleSlot = (
    <>
      <Link
        href={`/app/projects/${mockup.project_id}`}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-brand-soft hover:text-brand-ink"
        aria-label="Back to project"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <h1 className="truncate text-sm font-bold text-ink">{mockup.name}</h1>
    </>
  );
  const actionsSlot = (
    <>
      <RecentViewers viewers={viewers} />
      <ShareDialog mockupId={mockupId} />
      <NotificationBell />
      <ProfileMenu name={currentUserName} email={currentUserEmail} />
    </>
  );

  return (
    <div className="flex h-full flex-col">
      <RecordView mockupId={mockupId} />
      <div className="min-h-0 flex-1">
        {url ? (
          <MockupViewer
            mockupId={mockupId}
            projectId={mockup.project_id}
            imageUrl={url}
            imageName={mockup.name}
            initialPins={viewerPins}
            siblings={siblings ?? [{ id: mockupId }]}
            members={members}
            currentUserName={currentUserName}
            figmaEmbedUrl={figmaEmbedUrl}
            titleSlot={titleSlot}
            actionsSlot={actionsSlot}
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
