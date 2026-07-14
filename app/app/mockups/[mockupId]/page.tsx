import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMockupSignedUrl } from "@/app/app/projects/[projectId]/actions";
import { MockupViewer, type ViewerPin } from "@/components/viewer/MockupViewer";

export default async function MockupPage({
  params,
}: {
  params: Promise<{ mockupId: string }>;
}) {
  const { mockupId } = await params;
  const supabase = await createServerSupabase();

  const { data: mockup } = await supabase
    .from("mockups").select("id, name, file_path").eq("id", mockupId).maybeSingle();
  if (!mockup) notFound();

  const { data: pins } = await supabase
    .from("pins")
    .select("id, x, y, number, status, comments(id, body, parent_comment_id, created_at, profiles(name))")
    .eq("mockup_id", mockupId)
    .order("number", { ascending: true });

  const url = await getMockupSignedUrl(mockup.file_path);

  const viewerPins: ViewerPin[] = (pins ?? []).map((p) => ({
    id: p.id, x: p.x, y: p.y, number: p.number, status: p.status,
    // Supabase's untyped client infers nested one-to-many joins loosely (e.g. profiles as an
    // array); `any` here matches the query's actual runtime shape without hand-maintaining a
    // brittle structural type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    comments: (p.comments ?? []).map((c: any) => ({
      id: c.id, body: c.body, parentCommentId: c.parent_comment_id,
      createdAt: c.created_at, authorName: c.profiles?.name ?? "Someone",
    })),
  }));

  return (
    <div>
      <h1 className="mb-3 text-lg font-semibold">{mockup.name}</h1>
      {url && <MockupViewer mockupId={mockupId} imageUrl={url} initialPins={viewerPins} />}
    </div>
  );
}
