import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { getCurrentWorkspace } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const ws = await getCurrentWorkspace();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b p-4">
        <div className="flex gap-4">
          <Link href="/app" className="font-semibold">{ws?.name ?? "Markitup"}</Link>
          <Link href="/app/members" className="text-sm text-gray-600">Members</Link>
        </div>
        <form action={signOut}>
          <button className="text-sm underline">Sign out</button>
        </form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
