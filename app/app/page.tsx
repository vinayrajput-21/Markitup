import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace, createProject } from "./actions";

export default async function ProjectsPage() {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("workspace_id", ws?.id ?? "")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-lg font-semibold">Projects</h1>
      <form
        action={async (formData: FormData) => {
          "use server";
          await createProject(formData);
        }}
        className="mb-6 flex gap-2"
      >
        <input name="name" placeholder="New project name" className="flex-1 border p-2" required />
        <button className="bg-black px-4 text-white">Create</button>
      </form>
      <ul className="flex flex-col gap-2">
        {(projects ?? []).map((p) => (
          <li key={p.id}>
            <Link href={`/app/projects/${p.id}`} className="block border p-3 hover:bg-gray-50">
              {p.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
