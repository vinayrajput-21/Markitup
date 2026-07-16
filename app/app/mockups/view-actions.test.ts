import { describe, it, expect, vi } from "vitest";

const upsert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({ upsert }),
  }),
}));

describe("recordMockupView", () => {
  it("upserts the current user's view for the mockup", async () => {
    const { recordMockupView } = await import("./[mockupId]/view-actions");
    await expect(recordMockupView("m1")).resolves.toBeUndefined();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ mockup_id: "m1", user_id: "u1" }),
      expect.objectContaining({ onConflict: "mockup_id,user_id" }),
    );
  });

  it("does nothing when signed out (no throw)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/server", () => ({
      createServerSupabase: async () => ({
        auth: { getUser: async () => ({ data: { user: null } }) },
        from: () => ({ upsert }),
      }),
    }));
    const { recordMockupView } = await import("./[mockupId]/view-actions");
    await expect(recordMockupView("m1")).resolves.toBeUndefined();
  });
});
