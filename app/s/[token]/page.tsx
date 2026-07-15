import { redirect, notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

// Entry point for a shared MarkUp link. Always requires login. A public link
// grants the visitor reviewer access to the project (via join_project_via_share);
// a restricted link grants nothing, so a non-member is bounced by RLS.
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createServerSupabase();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(`/login?next=${encodeURIComponent(`/s/${token}`)}`);
  }

  const { data: mockupId, error } = await supabase.rpc("join_project_via_share", {
    p_token: token,
  });
  if (error || !mockupId) notFound();

  redirect(`/app/mockups/${mockupId}`);
}
