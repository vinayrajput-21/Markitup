"use server";

import { createServerSupabase } from "@/lib/supabase/server";

export type NotificationItem = {
  id: string;
  type: string;
  body: string;
  mockupId: string | null;
  readAt: string | null;
  createdAt: string;
  actorName: string;
};

export async function getNotifications(): Promise<{
  items: NotificationItem[];
  unreadCount: number;
}> {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { items: [], unreadCount: 0 };

  const { data } = await supabase
    .from("notifications")
    .select("id, type, body, mockup_id, read_at, created_at, actor:actor_id(name)")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const items: NotificationItem[] = (data ?? []).map((n) => ({
    id: n.id as string,
    type: n.type as string,
    body: n.body as string,
    mockupId: (n.mockup_id as string) ?? null,
    readAt: (n.read_at as string) ?? null,
    createdAt: n.created_at as string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actorName: ((n as any).actor?.name as string) || "Someone",
  }));
  const unreadCount = items.filter((i) => !i.readAt).length;
  return { items, unreadCount };
}

export async function markNotificationsRead(): Promise<void> {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userData.user.id)
    .is("read_at", null);
}
