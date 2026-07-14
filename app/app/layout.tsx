import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "./actions";
import { AppSidebar } from "@/components/app/AppSidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const ws = await getCurrentWorkspace();

  const userName = (data.user.user_metadata?.name as string) || "";
  const userEmail = data.user.email ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <AppSidebar
        workspaceName={ws?.name ?? "MarkUp"}
        userName={userName}
        userEmail={userEmail}
      />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
