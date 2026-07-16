import { describe, it, expect, vi } from "vitest";

const rows = [
  { id: "n1", type: "comment", body: "Jane commented on Home", mockup_id: "m1", read_at: null, created_at: "2026-07-16T10:00:00Z", actor: { name: "Jane" } },
  { id: "n2", type: "invite", body: "Ravi added you", mockup_id: null, read_at: "2026-07-16T09:00:00Z", created_at: "2026-07-16T09:00:00Z", actor: { name: "Ravi" } },
];
const orderMock = vi.fn().mockResolvedValue({ data: rows });
const updateEq2 = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: orderMock }) }) }),
      update: () => ({ eq: () => ({ is: updateEq2 }) }),
    }),
  }),
}));

describe("getNotifications", () => {
  it("maps rows and counts unread", async () => {
    const { getNotifications } = await import("./notifications-actions");
    const res = await getNotifications();
    expect(res.items).toHaveLength(2);
    expect(res.items[0].actorName).toBe("Jane");
    expect(res.unreadCount).toBe(1); // only n1 has read_at null
  });
});

describe("markNotificationsRead", () => {
  it("issues an update without throwing", async () => {
    const { markNotificationsRead } = await import("./notifications-actions");
    await expect(markNotificationsRead()).resolves.toBeUndefined();
    expect(updateEq2).toHaveBeenCalled();
  });
});
