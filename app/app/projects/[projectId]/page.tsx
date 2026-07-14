import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { UploadDropzone } from "@/components/viewer/UploadDropzone";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createServerSupabase();
  const { data: mockups } = await supabase
    .from("mockups")
    .select("id, name")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-lg font-semibold">Mockups</h1>
      <UploadDropzone projectId={projectId} />
      <ul className="grid grid-cols-2 gap-3">
        {(mockups ?? []).map((m) => (
          <li key={m.id}>
            <Link href={`/app/mockups/${m.id}`} className="block border p-3 hover:bg-gray-50">
              {m.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
