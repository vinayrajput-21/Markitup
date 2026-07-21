import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { CompareView, type CompareMockup } from "@/components/viewer/CompareView";

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ left?: string; right?: string }>;
}) {
  const { projectId } = await params;
  const { left, right } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const { data: rows } = await supabase
    .from("mockups")
    .select("id, name, file_path, created_at")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  const mockups = rows ?? [];

  const signed = new Map<string, string>();
  if (mockups.length) {
    const { data: urls } = await supabase.storage
      .from("mockups")
      .createSignedUrls(mockups.map((m) => m.file_path), 3600);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signed.set(u.path, u.signedUrl);
  }

  const list: CompareMockup[] = mockups
    .map((m) => ({ id: m.id, name: m.name, url: signed.get(m.file_path) ?? "" }))
    .filter((m) => m.url);

  const latest = list[list.length - 1];
  const previous = list[list.length - 2] ?? latest;
  const initialLeft = left && list.some((m) => m.id === left) ? left : previous?.id;
  const initialRight = right && list.some((m) => m.id === right) ? right : latest?.id;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b bg-surface px-3">
        <Link
          href={`/app/projects/${projectId}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-brand-soft hover:text-brand-ink"
          aria-label="Back to project"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="truncate text-sm font-bold text-ink">Compare · {project.name}</h1>
      </header>
      <div className="min-h-0 flex-1">
        {list.length < 2 ? (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-faint">
            Add at least two mockups to this project to compare them side by side.
          </div>
        ) : (
          <CompareView mockups={list} initialLeft={initialLeft} initialRight={initialRight} />
        )}
      </div>
    </div>
  );
}
