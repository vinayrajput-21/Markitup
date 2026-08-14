import { redirect, notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildEmbedUrl } from "@/lib/figma";
import { MockupViewer, type ViewerPin } from "@/components/viewer/MockupViewer";

// Entry point for a shared MarkUp link.
// - Logged-in visitors: redeem the link (public links grant reviewer access)
//   and go to the full in-app viewer.
// - Logged-out visitors on a PUBLIC link: see a guest viewer here and can leave
//   feedback with just a name (no account). Restricted links still require login.
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createServerSupabase();

  const { data: userData } = await supabase.auth.getUser();

  // Resolve the token (anon-capable). Unknown token => 404.
  const { data: linkRows } = await supabase.rpc("resolve_share_link", { p_token: token });
  const link = Array.isArray(linkRows) ? linkRows[0] : linkRows;
  if (!link) notFound();

  // Logged-in: keep the full member experience.
  if (userData.user) {
    const { data: mockupId, error } = await supabase.rpc("join_project_via_share", { p_token: token });
    if (error || !mockupId) notFound();
    redirect(`/app/mockups/${mockupId}`);
  }

  // Logged-out on a restricted link: must sign in.
  if (link.visibility !== "public") {
    redirect(`/login?next=${encodeURIComponent(`/s/${token}`)}`);
  }

  // ---- Logged-out guest on a PUBLIC link -----------------------------------
  const { data: mkRows } = await supabase.rpc("guest_share_mockup", { p_token: token });
  const mk = Array.isArray(mkRows) ? mkRows[0] : mkRows;
  if (!mk) notFound();

  const isFigma = mk.type === "figma";
  const isHtml = mk.type === "html";

  // Sign the file URL for a logged-out visitor (needs the service role).
  let fileUrl: string | null = null;
  if (!isFigma && mk.file_path) {
    const admin = createAdminSupabase();
    if (admin) {
      const { data } = await admin.storage.from("mockups").createSignedUrl(mk.file_path, 60 * 60);
      fileUrl = data?.signedUrl ?? null;
    }
  }
  const figmaEmbedUrl = isFigma && mk.figma_file_key
    ? buildEmbedUrl(mk.figma_file_key, mk.figma_node_id ?? "")
    : null;

  if (!isFigma && !fileUrl) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas p-8 text-center">
        <div>
          <h1 className="text-lg font-semibold text-ink">This shared design can’t be displayed</h1>
          <p className="mt-1 text-sm text-muted">Public sharing isn’t fully configured on the server yet.</p>
        </div>
      </div>
    );
  }

  const { data: pinsJson } = await supabase.rpc("guest_share_pins", { p_token: token });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawPins = (pinsJson ?? []) as any[];
  const initialPins: ViewerPin[] = rawPins.map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    number: p.number,
    status: p.status,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    comments: (p.comments ?? []).map((c: any) => ({
      id: c.id,
      body: c.body,
      authorName: c.authorName,
      parentCommentId: c.parentCommentId,
      createdAt: c.createdAt,
      attachments: [],
    })),
  }));

  return (
    <div className="h-screen">
      <MockupViewer
        mockupId={mk.mockup_id}
        projectId={mk.project_id}
        imageUrl={fileUrl ?? ""}
        imageName={mk.name}
        initialPins={initialPins}
        siblings={[{ id: mk.mockup_id }]}
        members={[]}
        currentUserName=""
        figmaEmbedUrl={figmaEmbedUrl}
        htmlUrl={isHtml ? fileUrl : null}
        guest={{ token }}
        titleSlot={
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">{mk.name}</span>
            <span className="hidden shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-ink sm:inline">Review</span>
          </div>
        }
      />
    </div>
  );
}
